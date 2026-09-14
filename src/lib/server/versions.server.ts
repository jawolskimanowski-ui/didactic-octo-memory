import { getSql } from "@/lib/db";
import { bumpVersion } from "@/lib/utils";
import type { VersionSource, VersionSummary } from "@/lib/types";
import { writeAudit } from "./audit.server";
import { recordLog, recordPublish } from "./analytics.server";
import { ForbiddenError, NotFoundError, ValidationError } from "./errors.server";
import { makeId } from "./ids.server";
import { requireOwnedProject } from "./ownership.server";
import { deliverWebhooks } from "./webhooks.server";

type VersionRow = {
  id: string;
  project_id: string;
  version: string;
  changelog: string;
  is_published: boolean;
  archived: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  byte_size: number;
};

function toSummary(row: VersionRow): VersionSummary {
  return {
    id: row.id,
    version: row.version,
    changelog: row.changelog,
    isPublished: Boolean(row.is_published),
    archived: Boolean(row.archived),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    byteSize: Number(row.byte_size) || 0,
  };
}

const VERSION_SELECT = `
  id, project_id, version, changelog, is_published, archived, created_by,
  created_at::text as created_at, updated_at::text as updated_at,
  octet_length(source_code) as byte_size
`;

export async function listVersionsForUser(
  userId: string,
  projectId: string,
): Promise<VersionSummary[]> {
  await requireOwnedProject(userId, projectId);
  const sql = await getSql();
  const rows = await sql.query<VersionRow>(
    `select ${VERSION_SELECT}
     from script_versions
     where project_id = $1 and archived = false
     order by created_at desc`,
    [projectId],
  );
  return rows.map(toSummary);
}

export async function getVersionSourceForUser(
  userId: string,
  projectId: string,
  versionId: string,
): Promise<VersionSource> {
  await requireOwnedProject(userId, projectId);
  const sql = await getSql();
  const rows = await sql.query<VersionRow & { source_code: string }>(
    `select ${VERSION_SELECT}, source_code
     from script_versions
     where id = $1 and project_id = $2`,
    [versionId, projectId],
  );
  const row = rows[0];
  if (!row) throw new NotFoundError("Version not found");
  await writeAudit(userId, projectId, "source.read", {
    versionId,
    version: row.version,
  });
  return { ...toSummary(row), sourceCode: row.source_code };
}

export async function getCurrentSourceForUser(
  userId: string,
  projectId: string,
): Promise<VersionSource> {
  const project = await requireOwnedProject(userId, projectId);
  if (!project.current_version_id) throw new NotFoundError("No source yet");
  return getVersionSourceForUser(userId, projectId, project.current_version_id);
}

export async function saveDraftInPlace(
  userId: string,
  projectId: string,
  input: { source: string; changelog?: string },
): Promise<VersionSummary> {
  const project = await requireOwnedProject(userId, projectId);
  const source = input.source;
  if (typeof source !== "string") throw new ValidationError("Source is required");
  if (source.length > 400_000) throw new ValidationError("Source exceeds 400 KB");
  const sql = await getSql();
  if (project.current_version_id) {
    const current = await sql.query<{ id: string; is_published: boolean; version: string }>(
      `select id, is_published, version from script_versions where id = $1 and project_id = $2`,
      [project.current_version_id, projectId],
    );
    const row = current[0];
    if (row && !row.is_published) {
      await sql.query(
        `update script_versions
         set source_code = $1, changelog = $2, updated_at = now()
         where id = $3`,
        [source, (input.changelog ?? "Autosaved draft").slice(0, 280), row.id],
      );
      await sql.query(
        `update projects set updated_at = now() where id = $1 and owner_id = $2`,
        [projectId, userId],
      );
      await writeAudit(userId, projectId, "source.update", {
        versionId: row.id,
        version: row.version,
        inPlace: true,
      });
      const created = await sql.query<VersionRow>(
        `select ${VERSION_SELECT} from script_versions where id = $1`,
        [row.id],
      );
      return toSummary(created[0]!);
    }
  }
  return saveNewVersion(userId, projectId, {
    source,
    changelog: input.changelog ?? "Saved draft",
    bump: "patch",
  });
}

export async function saveNewVersion(
  userId: string,
  projectId: string,
  input: {
    source: string;
    changelog?: string;
    bump?: "patch" | "minor" | "major";
  },
): Promise<VersionSummary> {
  const project = await requireOwnedProject(userId, projectId);
  const source = input.source;
  if (typeof source !== "string") throw new ValidationError("Source is required");
  if (source.length > 400_000) throw new ValidationError("Source exceeds 400 KB");
  const sql = await getSql();
  const latest = await sql.query<{ version: string }>(
    `select version from script_versions
     where project_id = $1
     order by created_at desc
     limit 1`,
    [projectId],
  );
  const next = bumpVersion(latest[0]?.version ?? "0.1.0", input.bump ?? "patch");
  const id = makeId("ver");
  await sql.query(
    `insert into script_versions
       (id, project_id, version, source_code, changelog, is_published, created_by)
     values ($1, $2, $3, $4, $5, false, $6)`,
    [id, projectId, next, source, (input.changelog ?? "Saved draft").slice(0, 280), userId],
  );
  await sql.query(
    `update projects
     set current_version_id = $1, updated_at = now()
     where id = $2 and owner_id = $3`,
    [id, projectId, userId],
  );
  await writeAudit(userId, projectId, "source.update", { versionId: id, version: next });
  void deliverWebhooks(projectId, "updated", {
    projectId,
    slug: project.slug,
    version: next,
  });
  const created = await sql.query<VersionRow>(
    `select ${VERSION_SELECT} from script_versions where id = $1`,
    [id],
  );
  return toSummary(created[0]!);
}

export async function publishVersion(
  userId: string,
  projectId: string,
  versionId: string,
): Promise<VersionSummary> {
  const project = await requireOwnedProject(userId, projectId);
  const sql = await getSql();
  const rows = await sql.query<VersionRow>(
    `select ${VERSION_SELECT} from script_versions where id = $1 and project_id = $2`,
    [versionId, projectId],
  );
  const version = rows[0];
  if (!version) throw new NotFoundError("Version not found");
  await sql.query(
    `update script_versions set is_published = false, updated_at = now()
     where project_id = $1 and is_published = true`,
    [projectId],
  );
  await sql.query(
    `update script_versions set is_published = true, updated_at = now() where id = $1`,
    [versionId],
  );
  await sql.query(
    `update projects
     set status = 'published',
         published_version_id = $1,
         current_version_id = $1,
         updated_at = now()
     where id = $2 and owner_id = $3`,
    [versionId, projectId, userId],
  );
  await writeAudit(userId, projectId, "version.publish", {
    versionId,
    version: version.version,
  });
  await recordPublish({
    projectId,
    versionId,
    userAgent: "publisher",
    region: null,
  });
  await recordLog({
    projectId,
    versionId,
    kind: "publish",
    message: `Published v${version.version}`,
    statusCode: 200,
    region: null,
    userAgent: "publisher",
  });
  void deliverWebhooks(projectId, "published", {
    projectId,
    slug: project.slug,
    version: version.version,
  });
  void deliverWebhooks(projectId, "version_published", {
    projectId,
    slug: project.slug,
    version: version.version,
  });
  return { ...toSummary(version), isPublished: true };
}

export async function rollbackToVersion(
  userId: string,
  projectId: string,
  versionId: string,
): Promise<VersionSummary> {
  const project = await requireOwnedProject(userId, projectId);
  const sql = await getSql();
  const rows = await sql.query<{ source_code: string; version: string }>(
    `select source_code, version from script_versions
     where id = $1 and project_id = $2`,
    [versionId, projectId],
  );
  const source = rows[0];
  if (!source) throw new NotFoundError("Version not found");
  await writeAudit(userId, projectId, "source.read", {
    versionId,
    reason: "rollback",
  });
  const created = await saveNewVersion(userId, projectId, {
    source: source.source_code,
    changelog: `Rolled back from ${source.version}`,
    bump: "patch",
  });
  const published = await publishVersion(userId, projectId, created.id);
  void deliverWebhooks(projectId, "updated", {
    projectId,
    slug: project.slug,
    version: published.version,
    rollbackFrom: source.version,
  });
  return published;
}

export async function archiveVersion(
  userId: string,
  projectId: string,
  versionId: string,
): Promise<void> {
  const project = await requireOwnedProject(userId, projectId);
  if (project.published_version_id === versionId) {
    throw new ForbiddenError("Cannot archive the published version");
  }
  const sql = await getSql();
  await sql.query(
    `update script_versions set archived = true, updated_at = now()
     where id = $1 and project_id = $2`,
    [versionId, projectId],
  );
  await writeAudit(userId, projectId, "version.archive", { versionId });
}

export async function compareVersionsForUser(
  userId: string,
  projectId: string,
  leftId: string,
  rightId: string,
): Promise<{ left: VersionSource; right: VersionSource }> {
  const left = await getVersionSourceForUser(userId, projectId, leftId);
  const right = await getVersionSourceForUser(userId, projectId, rightId);
  return { left, right };
}
