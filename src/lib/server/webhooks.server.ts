import { getSql } from "@/lib/db";
import { writeAudit } from "./audit.server";
import {
  decryptSecret,
  encryptSecret,
  generateWebhookSecret,
  hmacSha256,
  secretSuffix,
} from "./crypto.server";
import { NotFoundError, ValidationError } from "./errors.server";
import { makeId } from "./ids.server";
import { requireOwnedProject } from "./ownership.server";
import type { WebhookKind, WebhookPayloadMode, WebhookRecord } from "@/lib/types";

type WebhookRow = {
  id: string;
  name: string;
  endpoint: string;
  secret_suffix: string;
  events: string;
  enabled: boolean;
  last_status: number | null;
  last_fired_at: string | null;
  created_at: string;
  kind: string;
  payload_mode: string;
  discord_username: string | null;
  content_template: string | null;
};

function toRecord(row: WebhookRow): WebhookRecord {
  return {
    id: row.id,
    name: row.name,
    endpoint: row.endpoint,
    secretSuffix: row.secret_suffix,
    events: row.events.split(",").map((e) => e.trim()).filter(Boolean),
    enabled: Boolean(row.enabled),
    lastStatus: row.last_status,
    lastFiredAt: row.last_fired_at,
    createdAt: row.created_at,
    kind: (row.kind as WebhookKind) || "generic",
    payloadMode: (row.payload_mode as WebhookPayloadMode) || "full",
    discordUsername: row.discord_username,
    contentTemplate: row.content_template,
  };
}

const WEBHOOK_SELECT = `
  id, name, endpoint, secret_suffix, events, enabled, last_status,
  last_fired_at::text as last_fired_at, created_at::text as created_at,
  kind, payload_mode, discord_username, content_template
`;

export function detectWebhookKind(endpoint: string): WebhookKind {
  const url = endpoint.toLowerCase();
  if (/discord(?:app)?\.com\/api\/webhooks\//.test(url) || url.includes("discord.com/api/webhooks")) {
    return "discord";
  }
  if (url.includes("hooks.slack.com") || url.includes("slack.com/services")) return "slack";
  return "generic";
}

export async function listWebhooksForUser(userId: string, projectId: string) {
  await requireOwnedProject(userId, projectId);
  const sql = await getSql();
  const rows = await sql.query<WebhookRow>(
    `select ${WEBHOOK_SELECT} from webhooks where project_id = $1 order by created_at desc`,
    [projectId],
  );
  return rows.map(toRecord);
}

export async function listAllWebhooksForUser(userId: string) {
  const sql = await getSql();
  const rows = await sql.query<WebhookRow & { project_name: string; project_id: string }>(
    `select w.id, w.name, w.endpoint, w.secret_suffix, w.events, w.enabled, w.last_status,
            w.last_fired_at::text as last_fired_at, w.created_at::text as created_at,
            w.kind, w.payload_mode, w.discord_username, w.content_template,
            p.name as project_name, p.id as project_id
     from webhooks w
     join projects p on p.id = w.project_id
     where p.owner_id = $1
     order by w.created_at desc`,
    [userId],
  );
  return rows.map((row) => ({ ...toRecord(row), projectName: row.project_name, projectId: row.project_id }));
}

export type WebhookInput = {
  name: string;
  endpoint: string;
  events: string[];
  kind?: WebhookKind | "auto";
  payloadMode?: WebhookPayloadMode;
  discordUsername?: string;
  contentTemplate?: string;
};

export async function createWebhookForUser(
  userId: string,
  projectId: string,
  input: WebhookInput,
): Promise<WebhookRecord & { secret: string }> {
  await requireOwnedProject(userId, projectId);
  const name = input.name.trim();
  const endpoint = input.endpoint.trim();
  if (!name) throw new ValidationError("Webhook name is required");
  if (!/^https?:\/\//i.test(endpoint)) {
    throw new ValidationError("Webhook URL must start with http:// or https://");
  }
  const events = (input.events.length ? input.events : ["published"]).join(",");
  const kind: WebhookKind =
    !input.kind || input.kind === "auto" ? detectWebhookKind(endpoint) : input.kind;
  const payloadMode: WebhookPayloadMode = input.payloadMode ?? "full";
  const secret = generateWebhookSecret();
  const id = makeId("wh");
  const sql = await getSql();
  await sql.query(
    `insert into webhooks
       (id, project_id, name, endpoint, encrypted_secret, secret_suffix, events, enabled,
        kind, payload_mode, discord_username, content_template)
     values ($1, $2, $3, $4, $5, $6, $7, true, $8, $9, $10, $11)`,
    [
      id,
      projectId,
      name,
      endpoint,
      encryptSecret(secret),
      secretSuffix(secret),
      events,
      kind,
      payloadMode,
      (input.discordUsername ?? "").trim().slice(0, 80) || null,
      (input.contentTemplate ?? "").trim().slice(0, 500) || null,
    ],
  );
  await writeAudit(userId, projectId, "webhook.create", { webhookId: id, name, kind });
  const rows = await sql.query<WebhookRow>(
    `select ${WEBHOOK_SELECT} from webhooks where id = $1`,
    [id],
  );
  return { ...toRecord(rows[0]!), secret };
}

export async function updateWebhookForUser(
  userId: string,
  projectId: string,
  webhookId: string,
  patch: {
    name?: string;
    endpoint?: string;
    events?: string[];
    enabled?: boolean;
    kind?: WebhookKind;
    payloadMode?: WebhookPayloadMode;
    discordUsername?: string;
    contentTemplate?: string;
  },
): Promise<WebhookRecord> {
  await requireOwnedProject(userId, projectId);
  const sql = await getSql();
  const existing = await sql.query<WebhookRow>(
    `select ${WEBHOOK_SELECT} from webhooks where id = $1 and project_id = $2`,
    [webhookId, projectId],
  );
  if (!existing[0]) throw new NotFoundError("Webhook not found");
  const name = patch.name?.trim() || existing[0].name;
  const endpoint = patch.endpoint?.trim() || existing[0].endpoint;
  const events = patch.events ? patch.events.join(",") : existing[0].events;
  const enabled = patch.enabled ?? existing[0].enabled;
  const kind = patch.kind ?? (existing[0].kind as WebhookKind) ?? "generic";
  const payloadMode =
    patch.payloadMode ?? (existing[0].payload_mode as WebhookPayloadMode) ?? "full";
  const discordUsername =
    patch.discordUsername !== undefined
      ? patch.discordUsername.trim().slice(0, 80) || null
      : existing[0].discord_username;
  const contentTemplate =
    patch.contentTemplate !== undefined
      ? patch.contentTemplate.trim().slice(0, 500) || null
      : existing[0].content_template;
  await sql.query(
    `update webhooks
     set name = $1, endpoint = $2, events = $3, enabled = $4, kind = $5,
         payload_mode = $6, discord_username = $7, content_template = $8, updated_at = now()
     where id = $9 and project_id = $10`,
    [
      name,
      endpoint,
      events,
      enabled,
      kind,
      payloadMode,
      discordUsername,
      contentTemplate,
      webhookId,
      projectId,
    ],
  );
  const rows = await sql.query<WebhookRow>(
    `select ${WEBHOOK_SELECT} from webhooks where id = $1`,
    [webhookId],
  );
  return toRecord(rows[0]!);
}

export async function deleteWebhookForUser(
  userId: string,
  projectId: string,
  webhookId: string,
): Promise<void> {
  await requireOwnedProject(userId, projectId);
  const sql = await getSql();
  await sql.query(`delete from webhooks where id = $1 and project_id = $2`, [
    webhookId,
    projectId,
  ]);
  await writeAudit(userId, projectId, "webhook.delete", { webhookId });
}

function applyTemplate(
  template: string | null,
  event: string,
  payload: Record<string, unknown>,
): string {
  const slug = String(payload.slug ?? "");
  const version = String(payload.version ?? "");
  const project = String(payload.projectId ?? "");
  const message = String(payload.message ?? payload.body ?? event);
  const src = template || "{{event}} on {{slug}} (v{{version}})";
  return src
    .replaceAll("{{event}}", event)
    .replaceAll("{{slug}}", slug)
    .replaceAll("{{version}}", version)
    .replaceAll("{{project}}", project)
    .replaceAll("{{message}}", message);
}

function buildBody(
  hook: {
    kind: string;
    payload_mode: string;
    discord_username: string | null;
    content_template: string | null;
    endpoint: string;
  },
  event: string,
  payload: Record<string, unknown>,
): { body: string; contentType: string; headers: Record<string, string> } {
  const kind = hook.kind === "auto" ? detectWebhookKind(hook.endpoint) : hook.kind;
  const text = applyTemplate(hook.content_template, event, payload);
  const compact = {
    event,
    slug: payload.slug ?? null,
    version: payload.version ?? null,
    projectId: payload.projectId ?? null,
  };

  if (kind === "discord") {
    const embed = {
      title: event.replaceAll("_", " "),
      description: text,
      color: 0xc8ccd4,
      fields:
        hook.payload_mode === "custom"
          ? []
          : Object.entries(hook.payload_mode === "compact" ? compact : payload)
              .slice(0, 8)
              .map(([name, value]) => ({
                name,
                value: String(value ?? "—").slice(0, 200),
                inline: true,
              })),
      timestamp: new Date().toISOString(),
    };
    return {
      body: JSON.stringify({
        username: hook.discord_username || "loadstring.lua",
        content: hook.payload_mode === "custom" ? text : undefined,
        embeds: [embed],
      }),
      contentType: "application/json",
      headers: {},
    };
  }

  if (kind === "slack") {
    return {
      body: JSON.stringify({ text }),
      contentType: "application/json",
      headers: {},
    };
  }

  const data = hook.payload_mode === "compact" ? compact : hook.payload_mode === "custom" ? { text } : payload;
  return {
    body: JSON.stringify({
      event,
      deliveredAt: new Date().toISOString(),
      data,
    }),
    contentType: "application/json",
    headers: {},
  };
}

async function fireOne(
  hook: {
    id: string;
    endpoint: string;
    encrypted_secret: string;
    kind: string;
    payload_mode: string;
    discord_username: string | null;
    content_template: string | null;
  },
  event: string,
  payload: Record<string, unknown>,
): Promise<number> {
  const built = buildBody(hook, event, payload);
  let secret = "";
  try {
    secret = decryptSecret(hook.encrypted_secret);
  } catch {
    return 0;
  }
  const signature = hmacSha256(secret, built.body);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(hook.endpoint, {
      method: "POST",
      headers: {
        "content-type": built.contentType,
        "x-loadstring-event": event,
        "x-loadstring-signature": `sha256=${signature}`,
        "x-loadstring-delivery": makeId("del"),
        "user-agent": "loadstring.lua-webhook/1.0",
        ...built.headers,
      },
      body: built.body,
      signal: controller.signal,
    });
    return res.status;
  } catch {
    return 0;
  } finally {
    clearTimeout(timer);
  }
}

export async function deliverWebhooks(
  projectId: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const sql = await getSql();
  const hooks = await sql.query<{
    id: string;
    endpoint: string;
    encrypted_secret: string;
    events: string;
    kind: string;
    payload_mode: string;
    discord_username: string | null;
    content_template: string | null;
  }>(
    `select id, endpoint, encrypted_secret, events, kind, payload_mode,
            discord_username, content_template
     from webhooks
     where project_id = $1 and enabled = true`,
    [projectId],
  );
  for (const hook of hooks) {
    const allowed = hook.events.split(",").map((e) => e.trim());
    if (!allowed.includes(event)) continue;
    const status = await fireOne(hook, event, payload);
    await sql.query(
      `update webhooks set last_status = $1, last_fired_at = now(), updated_at = now()
       where id = $2`,
      [status, hook.id],
    );
  }
}

export async function testWebhookForUser(
  userId: string,
  projectId: string,
  webhookId: string,
): Promise<{ status: number }> {
  await requireOwnedProject(userId, projectId);
  const sql = await getSql();
  const rows = await sql.query<{
    id: string;
    endpoint: string;
    encrypted_secret: string;
    kind: string;
    payload_mode: string;
    discord_username: string | null;
    content_template: string | null;
  }>(
    `select id, endpoint, encrypted_secret, kind, payload_mode, discord_username, content_template
     from webhooks
     where id = $1 and project_id = $2`,
    [webhookId, projectId],
  );
  const hook = rows[0];
  if (!hook) throw new NotFoundError("Webhook not found");
  const status = await fireOne(hook, "test", {
    projectId,
    message: "Test delivery from loadstring.lua",
    slug: "test",
    version: "0.0.0",
  });
  await sql.query(
    `update webhooks set last_status = $1, last_fired_at = now(), updated_at = now()
     where id = $2`,
    [status, hook.id],
  );
  await writeAudit(userId, projectId, "webhook.test", { webhookId, status });
  return { status };
}

export async function proxyClientEvent(slug: string, body: unknown): Promise<void> {
  const sql = await getSql();
  const projects = await sql.query<{ id: string }>(
    `select id from projects where slug = $1 and status = 'published'`,
    [slug],
  );
  const project = projects[0];
  if (!project) throw new NotFoundError();
  await deliverWebhooks(project.id, "client_event", {
    slug,
    body,
  });
}
