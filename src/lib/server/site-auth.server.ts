import { randomBytes, randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import { ValidationError } from "./errors.server";
import { makeId } from "./ids.server";
import {
  actorFromInternalUser,
  hashPassword,
  verifyPassword,
  readSiteCookie,
  writeSiteCookie,
} from "./actor.server";

export type GeneratedCredentials = {
  uuid: string;
  password: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function strongPassword(): string {
  // 32 random bytes -> 43 base64url chars. It is generated only server-side.
  return randomBytes(32).toString("base64url");
}

async function uniqueUuid(): Promise<string> {
  const sql = await getSql();
  for (;;) {
    const uuid = randomUUID();
    const rows = await sql.query<{ user_id: string }>(
      `select user_id from creator_profiles where login_uuid = $1 limit 1`,
      [uuid],
    );
    if (!rows[0]) return uuid;
  }
}

export async function bootstrapSiteAccount(): Promise<{
  actor: Awaited<ReturnType<typeof actorFromInternalUser>>;
  credentials: GeneratedCredentials | null;
}> {
  const existing = await readSiteCookie();
  if (existing) {
    const sql = await getSql();
    const rows = await sql.query<{ login_uuid: string | null; password_hash: string | null }>(
      `select login_uuid, password_hash from creator_profiles where user_id = $1`,
      [existing.userId],
    );
    const row = rows[0];
    if (row?.login_uuid && row.password_hash) {
      const actor = await actorFromInternalUser(existing.userId);
      return { actor, credentials: null };
    }
    const uuid = await uniqueUuid();
    const password = strongPassword();
    await sql.query(
      `update creator_profiles
       set login_uuid = $1, password_hash = $2, password_changed_at = now(),
           is_guest = false, email_registered = false, updated_at = now()
       where user_id = $3`,
      [uuid, hashPassword(password), existing.userId],
    );
    const actor = await actorFromInternalUser(existing.userId);
    return { actor, credentials: { uuid, password } };
  }

  const sql = await getSql();
  const userId = makeId("usr");
  const uuid = await uniqueUuid();
  const password = strongPassword();
  const displayName = `user-${uuid.replaceAll("-", "").slice(0, 7)}`;
  await sql.query(
    `insert into creator_profiles
      (user_id, onboarded, display_name, email, email_registered, is_guest,
       avatar_hue, password_hash, login_uuid, password_changed_at, name_customized)
     values ($1, true, $2, null, false, false, $3, $4, $5, now(), false)`,
    [userId, displayName, 160 + Math.floor(Math.random() * 200), hashPassword(password), uuid],
  );

  const token = await issueSiteToken(userId);
  await writeSiteCookie(token, 365 * 24 * 3600);
  const actor = await actorFromInternalUser(userId);
  return { actor, credentials: { uuid, password } };
}

async function issueTokenFallback(userId: string): Promise<string> {
  // Node crypto hash avoids requiring a pg crypto extension on hosted Postgres.
  const { createHash } = await import("node:crypto");
  const token = randomBytes(32).toString("base64url");
  const sql = await getSql();
  const hash = createHash("sha256").update(token).digest("hex");
  await sql.query(
    `insert into site_tokens (id, token_hash, user_id, kind, expires_at)
     values ($1, $2, $3, 'site', now() + interval '365 days')`,
    [makeId("tok"), hash, userId],
  );
  return token;
}

export async function signInWithUuid(uuidInput: string, password: string) {
  const uuid = uuidInput.trim().toLowerCase();
  if (!UUID_RE.test(uuid) || password.length < 1) {
    throw new ValidationError("Invalid UUID or password");
  }
  const sql = await getSql();
  const rows = await sql.query<{
    user_id: string;
    password_hash: string | null;
  }>(
    `select user_id, password_hash from creator_profiles where login_uuid = $1 limit 1`,
    [uuid],
  );
  const row = rows[0];
  if (!row || !verifyPassword(password, row.password_hash)) {
    throw new ValidationError("Invalid UUID or password");
  }
  const token = await issueTokenFallback(row.user_id);
  await writeSiteCookie(token, 365 * 24 * 3600);
  return actorFromInternalUser(row.user_id);
}

export async function rotateLoginUuid(userId: string): Promise<string> {
  const uuid = await uniqueUuid();
  const sql = await getSql();
  await sql.query(
    `update creator_profiles set login_uuid = $1, updated_at = now() where user_id = $2`,
    [uuid, userId],
  );
  return uuid;
}

export async function changePasswordForUser(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  if (newPassword.length < 16) {
    throw new ValidationError("Use at least 16 characters for the new password");
  }
  const sql = await getSql();
  const rows = await sql.query<{ password_hash: string | null }>(
    `select password_hash from creator_profiles where user_id = $1`,
    [userId],
  );
  const row = rows[0];
  if (!row || !verifyPassword(currentPassword, row.password_hash)) {
    throw new ValidationError("Current password is incorrect");
  }
  await sql.query(
    `update creator_profiles set password_hash = $1, password_changed_at = now(), updated_at = now()
     where user_id = $2`,
    [hashPassword(newPassword), userId],
  );
}

export async function getUuidForUser(userId: string): Promise<string | null> {
  const sql = await getSql();
  const rows = await sql.query<{ login_uuid: string | null }>(
    `select login_uuid from creator_profiles where user_id = $1`,
    [userId],
  );
  return rows[0]?.login_uuid ?? null;
}
