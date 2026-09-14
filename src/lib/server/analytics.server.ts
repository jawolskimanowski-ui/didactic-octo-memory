import { getSql } from "@/lib/db";
import type { AnalyticsPayload } from "@/lib/types";
import { requireOwnedProject } from "./ownership.server";
import { makeId } from "./ids.server";
import { deliverWebhooks } from "./webhooks.server";

type EventInput = {
  projectId: string;
  versionId: string | null;
  statusCode: number;
  userAgent: string | null;
  region: string | null;
};

async function insertEvent(
  eventType: "execution" | "fetch" | "error" | "publish" | "boot",
  input: EventInput,
): Promise<void> {
  const sql = await getSql();
  await sql.query(
    `insert into analytics_events
       (id, project_id, version_id, event_type, status_code, user_agent, region)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      makeId("evt"),
      input.projectId,
      input.versionId,
      eventType,
      input.statusCode,
      (input.userAgent ?? "").slice(0, 180) || null,
      input.region,
    ],
  );
}

export async function recordLog(input: {
  projectId: string;
  versionId?: string | null;
  kind: string;
  message?: string | null;
  statusCode?: number;
  region?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  const sql = await getSql();
  await sql.query(
    `insert into execution_logs
       (id, project_id, version_id, kind, message, status_code, region, user_agent)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      makeId("log"),
      input.projectId,
      input.versionId ?? null,
      input.kind.slice(0, 40),
      (input.message ?? "").slice(0, 500) || null,
      input.statusCode ?? 200,
      input.region ?? null,
      (input.userAgent ?? "").slice(0, 180) || null,
    ],
  );
}

export async function recordPublish(
  input: Omit<EventInput, "statusCode"> & { statusCode?: number },
): Promise<void> {
  const payload: EventInput = { ...input, statusCode: input.statusCode ?? 200 };
  await insertEvent("publish", payload);
}

export async function recordExecution(input: EventInput): Promise<void> {
  await insertEvent("execution", input);
  await recordLog({
    projectId: input.projectId,
    versionId: input.versionId,
    kind: "execution",
    message: "Runtime beacon",
    statusCode: input.statusCode,
    region: input.region,
    userAgent: input.userAgent,
  });
  const sql = await getSql();
  const updated = await sql.query<{ execution_count: number }>(
    `update projects
     set execution_count = execution_count + 1
     where id = $1
     returning execution_count`,
    [input.projectId],
  );
  void deliverWebhooks(input.projectId, "execution", {
    projectId: input.projectId,
    statusCode: input.statusCode,
    region: input.region,
    totalExecutions: Number(updated[0]?.execution_count ?? 0),
  });
}

export async function recordFetch(input: EventInput): Promise<void> {
  await insertEvent("fetch", input);
  const sql = await getSql();
  if (input.statusCode >= 400) {
    await sql.query(
      `update projects set error_count = error_count + 1, fetch_count = fetch_count + 1 where id = $1`,
      [input.projectId],
    );
    void deliverWebhooks(input.projectId, "error", {
      projectId: input.projectId,
      statusCode: input.statusCode,
    });
  } else {
    await sql.query(
      `update projects set fetch_count = fetch_count + 1 where id = $1`,
      [input.projectId],
    );
  }
}

export async function recordRuntimeError(
  input: Omit<EventInput, "statusCode"> & { statusCode?: number },
): Promise<void> {
  const payload: EventInput = { ...input, statusCode: input.statusCode ?? 500 };
  await insertEvent("error", payload);
  const sql = await getSql();
  await sql.query(
    `update projects set error_count = error_count + 1 where id = $1`,
    [input.projectId],
  );
  void deliverWebhooks(input.projectId, "error", {
    projectId: input.projectId,
    statusCode: payload.statusCode,
  });
}

function fillSeries(
  rows: { day: string; executions: number; errors: number }[],
  days = 30,
): { day: string; executions: number; errors: number }[] {
  const map = new Map(rows.map((r) => [r.day, r]));
  const out: { day: string; executions: number; errors: number }[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i),
    );
    const key = d.toISOString().slice(0, 10);
    const found = map.get(key);
    out.push(found ?? { day: key, executions: 0, errors: 0 });
  }
  return out;
}

export async function getAnalyticsForUser(
  userId: string,
  projectId: string,
): Promise<AnalyticsPayload> {
  const project = await requireOwnedProject(userId, projectId);
  const sql = await getSql();

  const series = await sql.query<{
    day: string;
    executions: number;
    errors: number;
  }>(
    `select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
            sum(case when event_type = 'execution' then 1 else 0 end)::int as executions,
            sum(case when event_type = 'error' then 1 else 0 end)::int as errors
     from analytics_events
     where project_id = $1 and created_at >= now() - interval '30 days'
     group by 1
     order by 1`,
    [projectId],
  );

  const todayRow = await sql.query<{ n: number }>(
    `select count(*)::int as n from analytics_events
     where project_id = $1 and event_type = 'execution'
       and created_at >= date_trunc('day', now())`,
    [projectId],
  );
  const weekRow = await sql.query<{ n: number }>(
    `select count(*)::int as n from analytics_events
     where project_id = $1 and event_type = 'execution'
       and created_at >= now() - interval '7 days'`,
    [projectId],
  );
  const monthRow = await sql.query<{ n: number }>(
    `select count(*)::int as n from analytics_events
     where project_id = $1 and event_type = 'execution'
       and created_at >= now() - interval '30 days'`,
    [projectId],
  );
  const errorRow = await sql.query<{ n: number }>(
    `select count(*)::int as n from analytics_events
     where project_id = $1 and event_type = 'error'
       and created_at >= now() - interval '30 days'`,
    [projectId],
  );
  const fetchRow = await sql.query<{ n: number }>(
    `select count(*)::int as n from analytics_events
     where project_id = $1 and event_type = 'fetch'
       and created_at >= now() - interval '30 days'`,
    [projectId],
  );

  const statuses = await sql.query<{ status: number; count: number }>(
    `select status_code as status, count(*)::int as count
     from analytics_events
     where project_id = $1 and event_type = 'execution'
       and created_at >= now() - interval '30 days'
     group by status_code
     order by count desc`,
    [projectId],
  );

  const versions = await sql.query<{ version: string; count: number }>(
    `select coalesce(v.version, 'unknown') as version, count(*)::int as count
     from analytics_events e
     left join script_versions v on v.id = e.version_id
     where e.project_id = $1 and e.event_type = 'execution'
       and e.created_at >= now() - interval '30 days'
     group by 1
     order by count desc
     limit 8`,
    [projectId],
  );

  const regions = await sql.query<{ region: string; count: number }>(
    `select coalesce(region, 'Unknown') as region, count(*)::int as count
     from analytics_events
     where project_id = $1 and event_type = 'execution'
       and created_at >= now() - interval '30 days'
     group by 1
     order by count desc
     limit 8`,
    [projectId],
  );

  const recent = await sql.query<{
    id: string;
    event_type: string;
    status_code: number;
    region: string | null;
    created_at: string;
  }>(
    `select id, event_type, status_code, region, created_at::text as created_at
     from analytics_events
     where project_id = $1
     order by created_at desc
     limit 18`,
    [projectId],
  );

  const logs = await sql.query<{
    id: string;
    kind: string;
    message: string | null;
    status_code: number;
    created_at: string;
  }>(
    `select id, kind, message, status_code, created_at::text as created_at
     from execution_logs
     where project_id = $1
     order by created_at desc
     limit 24`,
    [projectId],
  );

  const published = project.published_version_id
    ? await sql.query<{ version: string }>(
        `select version from script_versions where id = $1`,
        [project.published_version_id],
      )
    : [];

  const monthExec = monthRow[0]?.n ?? 0;
  const monthErr = errorRow[0]?.n ?? 0;
  return {
    total: Number(project.execution_count) || 0,
    fetches: Number(project.fetch_count) || 0,
    fetchesMonth: fetchRow[0]?.n ?? 0,
    today: todayRow[0]?.n ?? 0,
    week: weekRow[0]?.n ?? 0,
    month: monthExec,
    errorRate: monthExec + monthErr === 0 ? 0 : monthErr / (monthExec + monthErr),
    currentVersion: published[0]?.version ?? null,
    runtimeId: project.runtime_id,
    series: fillSeries(series),
    statuses,
    versions,
    regions,
    recent: recent.map((r) => ({
      id: r.id,
      eventType: r.event_type,
      statusCode: r.status_code,
      region: r.region,
      createdAt: r.created_at,
    })),
    logs: logs.map((r) => ({
      id: r.id,
      kind: r.kind,
      message: r.message,
      statusCode: r.status_code,
      createdAt: r.created_at,
    })),
  };
}

export async function getOwnerOverview(userId: string) {
  const sql = await getSql();
  const totals = await sql.query<{
    projects: number;
    published: number;
    executions: number;
    fetches: number;
    errors: number;
  }>(
    `select count(*)::int as projects,
            sum(case when status = 'published' then 1 else 0 end)::int as published,
            coalesce(sum(execution_count), 0)::int as executions,
            coalesce(sum(fetch_count), 0)::int as fetches,
            coalesce(sum(error_count), 0)::int as errors
     from projects
     where owner_id = $1 and status <> 'archived'`,
    [userId],
  );
  return (
    totals[0] ?? {
      projects: 0,
      published: 0,
      executions: 0,
      fetches: 0,
      errors: 0,
    }
  );
}
