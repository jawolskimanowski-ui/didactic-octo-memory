import { getSql } from "@/lib/db";
import { makeId } from "./ids.server";
import { newUuid } from "./protect.server";
import {
  INVENTORY_BRIDGE_SOURCE,
  JOIN_NOTIFIER_SOURCE,
  STARTER_SOURCE,
} from "./templates.server";
import { writeAudit } from "./audit.server";

export async function ensureOnboarded(userId: string): Promise<{ seeded: boolean }> {
  const sql = await getSql();
  const claimed = await sql.query<{ user_id: string }>(
    `insert into creator_profiles (user_id, onboarded) values ($1, true)
     on conflict (user_id) do nothing
     returning user_id`,
    [userId],
  );
  if (!claimed[0]) return { seeded: false };

  const existing = await sql.query<{ n: number }>(
    `select count(*)::int as n from projects where owner_id = $1`,
    [userId],
  );
  if ((existing[0]?.n ?? 0) > 0) return { seeded: false };

  const hud = makeId("prj");
  const join = makeId("prj");
  const inv = makeId("prj");
  const hudSlug = `welcome-hud-${hud.slice(-6)}`;
  const joinSlug = `join-notifier-${join.slice(-6)}`;
  const invSlug = `inventory-bridge-${inv.slice(-6)}`;

  const vHud = [
    { id: makeId("ver"), version: "1.0.0", source: STARTER_SOURCE, published: false, log: "Initial HUD" },
    { id: makeId("ver"), version: "1.1.0", source: STARTER_SOURCE, published: false, log: "Copy tweak" },
    { id: makeId("ver"), version: "1.1.1", source: STARTER_SOURCE, published: false, log: "Stroke color" },
    { id: makeId("ver"), version: "1.2.0", source: STARTER_SOURCE, published: true, log: "Stable publish" },
  ];
  const vJoin = [
    { id: makeId("ver"), version: "0.9.0", source: JOIN_NOTIFIER_SOURCE, published: false, log: "First draft" },
    { id: makeId("ver"), version: "0.9.4", source: JOIN_NOTIFIER_SOURCE, published: true, log: "pcall around SetCore" },
  ];
  const vInv = [
    { id: makeId("ver"), version: "0.1.0", source: INVENTORY_BRIDGE_SOURCE, published: false, log: "Module scaffold" },
  ];

  await sql.query(
    `insert into projects
       (id, owner_id, name, slug, description, status, current_version_id, published_version_id,
        runtime_id, wrap_seed, execution_count, fetch_count, error_count)
     values
       ($1, $2, 'WelcomeHUD', $3, 'Private ScreenGui toast confirming the hosted script executed.', 'published', $4, $4, $5, $6, 0, 0, 0),
       ($7, $2, 'JoinNotifier', $8, 'Local join announcement for experience testing.', 'published', $9, $9, $10, $11, 0, 0, 0),
       ($12, $2, 'InventoryBridge', $13, 'Unpublished module draft. Source stays private until you publish.', 'draft', $14, null, $15, $16, 0, 0, 0)`,
    [
      hud,
      userId,
      hudSlug,
      vHud[3]!.id,
      newUuid(),
      newUuid(),
      join,
      joinSlug,
      vJoin[1]!.id,
      newUuid(),
      newUuid(),
      inv,
      invSlug,
      vInv[0]!.id,
      newUuid(),
      newUuid(),
    ],
  );

  for (const v of vHud) {
    const days = vHud.indexOf(v) === 3 ? 0 : 8 - vHud.indexOf(v);
    const created = new Date();
    created.setUTCDate(created.getUTCDate() - days);
    await sql.query(
      `insert into script_versions
         (id, project_id, version, source_code, changelog, is_published, created_by, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz)`,
      [v.id, hud, v.version, v.source, v.log, v.published, userId, created.toISOString()],
    );
  }
  for (const v of vJoin) {
    await sql.query(
      `insert into script_versions
         (id, project_id, version, source_code, changelog, is_published, created_by)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [v.id, join, v.version, v.source, v.log, v.published, userId],
    );
  }
  await sql.query(
    `insert into script_versions
       (id, project_id, version, source_code, changelog, is_published, created_by)
     values ($1, $2, $3, $4, $5, false, $6)`,
    [vInv[0]!.id, inv, vInv[0]!.version, vInv[0]!.source, vInv[0]!.log, userId],
  );

  await writeAudit(userId, hud, "project.create", { seeded: true });
  await writeAudit(userId, hud, "version.publish", { version: "1.2.0", seeded: true });

  return { seeded: true };
}
