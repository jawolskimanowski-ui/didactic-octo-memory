import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getSql } from "@/lib/db";
import { UnauthorizedError } from "./errors.server";
import { ValidationError } from "./errors.server";
import { makeId } from "./ids.server";

export const GUEST_DEPLOY_LIMIT = 10;
export const GUEST_COOKIE = "ls_guest_token";
export const SITE_COOKIE = "ls_site_token";

export type ActorKind = "registered" | "guest";

export type Actor = {
  userId: string;
  kind: ActorKind;
  email: string | null;
  displayName: string;
  nameCustomized: boolean;
  handle: string | null;
  bio: string;
  avatarHue: number;
  emailRegistered: boolean;
  isGuest: boolean;
  publishedCount: number;
  projectCount: number;
  remainingDeploys: number | null;
};

export type ProfileUpdate = {
  displayName?: string;
  handle?: string | null;
  bio?: string;
  avatarHue?: number;
};

const FAKE_EMAIL_RE =
  /@(?:viewer\.)?grok\.invalid$|\.invalid$|@guest\.local$|@example\.com$/i;

export function isRealEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  if (e.length > 190) return false;
  if (FAKE_EMAIL_RE.test(e)) return false;
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, `ls.lua:${salt}`, 32).toString("base64url");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = parts[1]!;
  const expected = parts[2]!;
  const actual = scryptSync(password, `ls.lua:${salt}`, 32).toString("base64url");
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function cookieSecure(): Promise<boolean> {
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    if (!request) return false;
    const proto = (request.headers.get("x-forwarded-proto") || "").toLowerCase();
    if (proto.includes("https")) return true;
    return request.url.startsWith("https:");
  } catch {
    return false;
  }
}

export async function readCookie(name: string): Promise<string | null> {
  try {
    const { getCookie } = await import("@tanstack/react-start/server");
    const value = getCookie(name);
    return value && value.length > 8 ? value : null;
  } catch {
    return null;
  }
}

async function writeCookie(
  name: string,
  value: string,
  maxAge: number,
): Promise<void> {
  const { setCookie } = await import("@tanstack/react-start/server");
  setCookie(name, value, {
    path: "/",
    httpOnly: true,
    secure: await cookieSecure(),
    sameSite: "lax",
    maxAge,
  });
}

async function clearCookie(name: string): Promise<void> {
  try {
    const { setCookie } = await import("@tanstack/react-start/server");
    setCookie(name, "", {
      path: "/",
      httpOnly: true,
      secure: await cookieSecure(),
      sameSite: "lax",
      maxAge: 0,
    });
  } catch {
    /* ignore */
  }
}

type ProfileRow = {
  user_id: string;
  display_name: string;
  handle: string | null;
  bio: string;
  email: string | null;
  email_registered: boolean;
  is_guest: boolean;
  avatar_hue: number;
  password_hash: string | null;
  login_uuid: string | null;
  name_customized: boolean;
  auth_user_id: string | null;
};

const PROFILE_COLS = `
  user_id, display_name, handle, bio, email, email_registered, is_guest,
  avatar_hue, password_hash, login_uuid, auth_user_id, name_customized
`;

async function countsFor(userId: string): Promise<{
  publishedCount: number;
  projectCount: number;
}> {
  const sql = await getSql();
  const rows = await sql.query<{ published: number; total: number }>(
    `select
        coalesce(sum(case when status = 'published' then 1 else 0 end), 0)::int as published,
        count(*)::int as total
     from projects
     where owner_id = $1 and status <> 'archived'`,
    [userId],
  );
  return {
    publishedCount: rows[0]?.published ?? 0,
    projectCount: rows[0]?.total ?? 0,
  };
}

function toActor(
  row: ProfileRow,
  counts: { publishedCount: number; projectCount: number },
): Actor {
  const emailRegistered = Boolean(row.email_registered) && isRealEmail(row.email);
  const hasUuidCredentials = Boolean(row.login_uuid && row.password_hash);
  const isGuest = !hasUuidCredentials && Boolean(row.is_guest) && !emailRegistered;
  return {
    userId: row.user_id,
    kind: isGuest ? "guest" : "registered",
    email: row.email,
    displayName: row.display_name || (emailRegistered ? row.email!.split("@")[0]! : "Guest"),
    nameCustomized: Boolean(row.name_customized),
    handle: row.handle,
    bio: row.bio,
    avatarHue: Number(row.avatar_hue) || 210,
    emailRegistered,
    isGuest,
    publishedCount: counts.publishedCount,
    projectCount: counts.projectCount,
    remainingDeploys: isGuest
      ? Math.max(0, GUEST_DEPLOY_LIMIT - counts.publishedCount)
      : null,
  };
}

export async function loadProfile(userId: string): Promise<ProfileRow | null> {
  const sql = await getSql();
  const rows = await sql.query<ProfileRow>(
    `select ${PROFILE_COLS} from creator_profiles where user_id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function ensureProfileRow(
  userId: string,
  seed: {
    email?: string | null;
    name?: string | null;
    guest?: boolean;
    authUserId?: string | null;
  } = {},
): Promise<ProfileRow> {
  const existing = await loadProfile(userId);
  if (existing) {
    const real = isRealEmail(seed.email ?? existing.email);
    const sql = await getSql();
    if (
      (real && !existing.email_registered) ||
      (seed.authUserId && seed.authUserId !== existing.auth_user_id)
    ) {
      await sql.query(
        `update creator_profiles
         set email = coalesce($2, email),
             email_registered = case when $3 then true else email_registered end,
             is_guest = case when $3 then false else is_guest end,
             display_name = case when display_name = '' and $4 <> '' then $4 else display_name end,
             auth_user_id = coalesce($5, auth_user_id),
             updated_at = now()
         where user_id = $1`,
        [
          userId,
          real ? seed.email!.trim().toLowerCase() : existing.email,
          real,
          (seed.name ?? "").trim(),
          seed.authUserId ?? null,
        ],
      );
      return (await loadProfile(userId))!;
    }
    return existing;
  }

  const email = isRealEmail(seed.email) ? seed.email!.trim().toLowerCase() : null;
  const registered = Boolean(email);
  const guest = seed.guest ?? !registered;
  const display = (seed.name ?? "").trim();
  const hue = 160 + Math.floor(Math.random() * 140);
  const sql = await getSql();
  await sql.query(
    `insert into creator_profiles
       (user_id, onboarded, display_name, email, email_registered, is_guest,
        avatar_hue, auth_user_id, name_customized)
     values ($1, true, $2, $3, $4, $5, $6, $7, false)
     on conflict (user_id) do nothing`,
    [userId, display, email, registered, guest, hue, seed.authUserId ?? null],
  );
  return (await loadProfile(userId))!;
}

export async function actorFromInternalUser(userId: string): Promise<Actor> {
  const row = await ensureProfileRow(userId);
  const counts = await countsFor(userId);
  return toActor(row, counts);
}

async function lookupToken(
  raw: string,
  kind: "guest" | "site",
): Promise<string | null> {
  const sql = await getSql();
  const rows = await sql.query<{ user_id: string }>(
    `select user_id from site_tokens
     where token_hash = $1 and kind = $2
       and (expires_at is null or expires_at > now())`,
    [hashToken(raw), kind],
  );
  const userId = rows[0]?.user_id;
  if (!userId) return null;
  await sql.query(
    `update site_tokens set last_seen_at = now() where token_hash = $1`,
    [hashToken(raw)],
  );
  return userId;
}

async function issueToken(
  userId: string,
  kind: "guest" | "site",
  days: number,
): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  const sql = await getSql();
  const expires =
    days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null;
  await sql.query(
    `insert into site_tokens (id, token_hash, user_id, kind, expires_at)
     values ($1, $2, $3, $4, $5::timestamptz)`,
    [makeId("tok"), hashToken(token), userId, kind, expires],
  );
  return token;
}

export async function continueAsGuest(): Promise<Actor> {
  const existing = await readCookie(GUEST_COOKIE);
  if (existing) {
    const userId = await lookupToken(existing, "guest");
    if (userId) return actorFromInternalUser(userId);
  }
  const userId = makeId("gst");
  await ensureProfileRow(userId, { guest: true, name: "Guest" });
  const token = await issueToken(userId, "guest", 365);
  await writeCookie(GUEST_COOKIE, token, 365 * 24 * 3600);
  return actorFromInternalUser(userId);
}

export async function readSiteCookie(): Promise<{ token: string; userId: string } | null> {
  const token = await readCookie(SITE_COOKIE);
  if (!token) return null;
  const userId = await lookupToken(token, "site");
  return userId ? { token, userId } : null;
}

export async function writeSiteCookie(value: string, maxAge: number): Promise<void> {
  await writeCookie(SITE_COOKIE, value, maxAge);
}

export async function clearSiteCookie(): Promise<void> {
  await clearCookie(SITE_COOKIE);
}

export async function resolveActor(input: {
  bearerToken?: string;
  createGuest?: boolean;
}): Promise<Actor | null> {
  // UUID accounts are authenticated exclusively by the server-issued HTTP-only
  // site cookie. No OAuth/email session is consulted here.
  const siteTok = await readCookie(SITE_COOKIE);
  if (siteTok) {
    const userId = await lookupToken(siteTok, "site");
    if (userId) return actorFromInternalUser(userId);
  }

  const guestTok = await readCookie(GUEST_COOKIE);
  if (guestTok) {
    const userId = await lookupToken(guestTok, "guest");
    if (userId) return actorFromInternalUser(userId);
  }

  if (input.createGuest) return continueAsGuest();
  return null;
}

export async function requireActor(bearerToken?: string): Promise<Actor> {
  const actor = await resolveActor({ bearerToken, createGuest: false });
  if (!actor) throw new UnauthorizedError();
  return actor;
}

export async function assertCanCreateProject(actor: Actor): Promise<void> {
  if (!actor.isGuest) return;
  if (actor.projectCount >= GUEST_DEPLOY_LIMIT) {
    throw new ValidationError(
      `Legacy guest accounts can keep ${GUEST_DEPLOY_LIMIT} Lua projects. Create a UUID account to lift the limit.`,
    );
  }
}

export async function assertCanPublish(actor: Actor, alreadyPublished: boolean): Promise<void> {
  if (!actor.isGuest) return;
  if (alreadyPublished) return;
  if (actor.publishedCount >= GUEST_DEPLOY_LIMIT) {
    throw new ValidationError(
      `Legacy guest accounts can deploy ${GUEST_DEPLOY_LIMIT} Lua projects. Create a UUID account to publish more.`,
    );
  }
}

export async function updateProfileForActor(
  actor: Actor,
  patch: ProfileUpdate,
): Promise<Actor> {
  const displayName = (patch.displayName ?? actor.displayName).trim().slice(0, 80);
  if (!displayName) throw new ValidationError("Display name is required");
  let handle =
    patch.handle === undefined
      ? actor.handle
      : patch.handle
        ? patch.handle
            .toLowerCase()
            .replace(/[^a-z0-9_]+/g, "")
            .slice(0, 24)
        : null;
  if (handle === "") handle = null;
  const bio = (patch.bio ?? actor.bio).trim().slice(0, 280);
  const hue = Math.max(0, Math.min(359, patch.avatarHue ?? actor.avatarHue));
  const sql = await getSql();
  if (handle && handle !== actor.handle) {
    const clash = await sql.query<{ user_id: string }>(
      `select user_id from creator_profiles where handle = $1 and user_id <> $2`,
      [handle, actor.userId],
    );
    if (clash[0]) throw new ValidationError("That handle is taken");
  }
  await sql.query(
    `update creator_profiles
     set display_name = $1, handle = $2, bio = $3, avatar_hue = $4, name_customized = true, updated_at = now()
     where user_id = $5`,
    [displayName, handle, bio, hue, actor.userId],
  );
  return actorFromInternalUser(actor.userId);
}

export async function registerEmailForActor(
  actor: Actor,
  input: { email: string; password: string; name?: string },
): Promise<Actor> {
  const email = input.email.trim().toLowerCase();
  if (!isRealEmail(email)) {
    throw new ValidationError("Enter a real email address you control");
  }
  if (!input.password || input.password.length < 8) {
    throw new ValidationError("Password must be at least 8 characters");
  }
  const sql = await getSql();
  const taken = await sql.query<{ user_id: string }>(
    `select user_id from creator_profiles
     where email = $1 and user_id <> $2 and email_registered = true`,
    [email, actor.userId],
  );
  if (taken[0]) throw new ValidationError("That email is already registered");
  const display = (input.name ?? actor.displayName).trim().slice(0, 80) || email.split("@")[0]!;
  await sql.query(
    `update creator_profiles
     set email = $1,
         password_hash = $2,
         email_registered = true,
         is_guest = false,
         display_name = $3,
         updated_at = now()
     where user_id = $4`,
    [email, hashPassword(input.password), display, actor.userId],
  );
  const token = await issueToken(actor.userId, "site", 30);
  await writeCookie(SITE_COOKIE, token, 30 * 24 * 3600);
  await clearCookie(GUEST_COOKIE);
  return actorFromInternalUser(actor.userId);
}

export async function siteSignIn(input: {
  email: string;
  password: string;
}): Promise<Actor> {
  const email = input.email.trim().toLowerCase();
  if (!isRealEmail(email)) throw new ValidationError("Invalid email or password");
  const sql = await getSql();
  const rows = await sql.query<ProfileRow>(
    `select ${PROFILE_COLS} from creator_profiles
     where email = $1 and email_registered = true`,
    [email],
  );
  const row = rows[0];
  if (!row || !verifyPassword(input.password, row.password_hash)) {
    throw new ValidationError("Invalid email or password");
  }
  const token = await issueToken(row.user_id, "site", 30);
  await writeCookie(SITE_COOKIE, token, 30 * 24 * 3600);
  await clearCookie(GUEST_COOKIE);
  return actorFromInternalUser(row.user_id);
}

export async function siteSignOut(): Promise<void> {
  const site = await readCookie(SITE_COOKIE);
  const guest = await readCookie(GUEST_COOKIE);
  const sql = await getSql();
  if (site) {
    await sql.query(`delete from site_tokens where token_hash = $1`, [hashToken(site)]);
  }
  if (guest) {
    await sql.query(`delete from site_tokens where token_hash = $1`, [hashToken(guest)]);
  }
  await clearCookie(SITE_COOKIE);
  await clearCookie(GUEST_COOKIE);
}

export async function claimGuestToUser(
  sessionUserId: string,
  sessionEmail: string | null,
): Promise<Actor> {
  const guestTok = await readCookie(GUEST_COOKIE);
  let guestId: string | null = null;
  if (guestTok) guestId = await lookupToken(guestTok, "guest");

  const sql = await getSql();
  if (guestId && guestId !== sessionUserId) {
    await sql.query(`update projects set owner_id = $1 where owner_id = $2`, [
      sessionUserId,
      guestId,
    ]);
    await sql.query(`update audit_logs set user_id = $1 where user_id = $2`, [
      sessionUserId,
      guestId,
    ]);
    const guestProfile = await loadProfile(guestId);
    await ensureProfileRow(sessionUserId, {
      email: sessionEmail,
      authUserId: sessionUserId,
      name: guestProfile?.display_name || sessionEmail?.split("@")[0] || "Creator",
      guest: !isRealEmail(sessionEmail),
    });
    if (guestProfile) {
      await sql.query(
        `update creator_profiles
         set display_name = case when display_name = '' then $2 else display_name end,
             handle = coalesce(handle, $3),
             bio = case when bio = '' then $4 else bio end,
             password_hash = coalesce(password_hash, $5),
             email = coalesce(email, $6),
             email_registered = email_registered or $7,
             is_guest = case when $7 then false else is_guest end,
             auth_user_id = $1,
             updated_at = now()
         where user_id = $1`,
        [
          sessionUserId,
          guestProfile.display_name,
          guestProfile.handle,
          guestProfile.bio,
          guestProfile.password_hash,
          isRealEmail(sessionEmail) ? sessionEmail : guestProfile.email,
          isRealEmail(sessionEmail) || Boolean(guestProfile.email_registered),
        ],
      );
    }
    await sql.query(`delete from creator_profiles where user_id = $1`, [guestId]);
    await sql.query(`delete from site_tokens where user_id = $1`, [guestId]);
  } else {
    await ensureProfileRow(sessionUserId, {
      email: sessionEmail,
      authUserId: sessionUserId,
      guest: !isRealEmail(sessionEmail),
      name: sessionEmail?.split("@")[0] || "Creator",
    });
  }
  await clearCookie(GUEST_COOKIE);
  return actorFromInternalUser(sessionUserId);
}

export async function changePasswordForActor(
  actor: Actor,
  input: { currentPassword: string; newPassword: string },
): Promise<void> {
  if (input.newPassword.length < 8) {
    throw new ValidationError("Password must be at least 8 characters");
  }
  const row = await loadProfile(actor.userId);
  if (!row) throw new UnauthorizedError();
  if (row.password_hash && !verifyPassword(input.currentPassword, row.password_hash)) {
    throw new ValidationError("Current password is incorrect");
  }
  if (!row.password_hash && !row.email_registered) {
    throw new ValidationError("Register an email before setting a password");
  }
  const sql = await getSql();
  await sql.query(
    `update creator_profiles set password_hash = $1, updated_at = now() where user_id = $2`,
    [hashPassword(input.newPassword), actor.userId],
  );
}
