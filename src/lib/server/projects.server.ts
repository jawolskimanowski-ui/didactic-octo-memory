import { getSql } from "@/lib/db";
import { slugify } from "@/lib/utils";
import type { ProjectStatus, ProjectSummary } from "@/lib/types";
import { writeAudit } from "./audit.server";
import { ValidationError } from "./errors.server";
import { makeId } from "./ids.server";
import { requireOwnedProject, type ProjectRow } from "./ownership.server";
import { newUuid } from "./protect.server";
import { STARTER_SOURCE } from "./templates.server";

function toSummary(
  row: ProjectRow & { current_version?: string | null; published_version?: string | null },
): ProjectSummary {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    status: row.status,
    currentVersion: row.current_version ?? null,
    publishedVersion: row.published_version ?? null,
    runtimeId: row.runtime_id,
    executionCount: Number(row.execution_count) || 0,
    fetchCount: Number(row.fetch_count) || 0,
    errorCount: Number(row.error_count) || 0,
    obfuscate: Boolean(row.obfuscate),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listProjectsForUser(userId: string): Promise<ProjectSummary[]> {
  const sql = await getSql();
  const rows = await sql.query<
    ProjectRow & { current_version: string | null; published_version: string | null }
  >(
    `select p.id, p.owner_id, p.name, p.slug, p.description, p.status,
            p.current_version_id, p.published_version_id, p.runtime_id,
            p.execution_count, p.fetch_count, p.error_count, p.obfuscate,
            p.created_at::text as created_at, p.updated_at::text as updated_at,
            cv.version as current_version,
            pv.version as published_version
     from projects p
     left join script_versions cv on cv.id = p.current_version_id
     left join script_versions pv on pv.id = p.published_version_id
     where p.owner_id = $1 and p.status <> 'archived'
     order by p.updated_at desc`,
    [userId],
  );
  return rows.map(toSummary);
}

export async function getProjectForUser(
  userId: string,
  projectId: string,
): Promise<ProjectSummary> {
  const project = await requireOwnedProject(userId, projectId);
  const sql = await getSql();
  const versions = await sql.query<{ id: string; version: string }>(
    `select id, version from script_versions
     where id = $1 or id = $2`,
    [project.current_version_id, project.published_version_id],
  );
  const map = new Map(versions.map((v) => [v.id, v.version]));
  return toSummary({
    ...project,
    current_version: project.current_version_id
      ? (map.get(project.current_version_id) ?? null)
      : null,
    published_version: project.published_version_id
      ? (map.get(project.published_version_id) ?? null)
      : null,
  });
}

async function uniqueSlug(base: string): Promise<string> {
  const sql = await getSql();
  let slug = slugify(base);
  for (let i = 0; i < 12; i += 1) {
    const existing = await sql.query<{ id: string }>(
      `select id from projects where slug = $1`,
      [slug],
    );
    if (!existing[0]) return slug;
    slug = `${slugify(base)}-${makeId("s").slice(-6)}`;
  }
  return `${slugify(base)}-${makeId("s").slice(-8)}`;
}

export async function createProjectForUser(
  userId: string,
  input: {
    name: string;
    description?: string;
    source?: string;
    slug?: string;
    obfuscate?: boolean;
  },
): Promise<ProjectSummary> {
  const name = input.name.trim();
  if (!name) throw new ValidationError("Project name is required");
  if (name.length > 80) throw new ValidationError("Name is too long");
  const description = (input.description ?? "").trim().slice(0, 500);
  const sql = await getSql();
  const id = makeId("prj");
  const slug = await uniqueSlug(input.slug || name);
  const versionId = makeId("ver");
  const runtimeId = newUuid();
  const wrapSeed = newUuid();
  const source = (input.source ?? STARTER_SOURCE).slice(0, 400_000);
  const obfuscate = Boolean(input.obfuscate);

  await sql.query(
    `insert into projects
       (id, owner_id, name, slug, description, status, current_version_id, runtime_id, wrap_seed, obfuscate)
     values ($1, $2, $3, $4, $5, 'draft', $6, $7, $8, $9)`,
    [id, userId, name, slug, description, versionId, runtimeId, wrapSeed, obfuscate],
  );
  await sql.query(
    `insert into script_versions
       (id, project_id, version, source_code, changelog, is_published, created_by)
     values ($1, $2, '0.1.0', $3, 'Initial private draft', false, $4)`,
    [versionId, id, source, userId],
  );
  await writeAudit(userId, id, "project.create", { name, slug, obfuscate });
  return getProjectForUser(userId, id);
}

export async function updateProjectSettings(
  userId: string,
  projectId: string,
  patch: { name?: string; description?: string; slug?: string; obfuscate?: boolean },
): Promise<ProjectSummary> {
  const project = await requireOwnedProject(userId, projectId);
  const sql = await getSql();
  const name = patch.name?.trim() || project.name;
  const description =
    patch.description !== undefined
      ? patch.description.trim().slice(0, 500)
      : project.description;
  let slug = project.slug;
  if (patch.slug && patch.slug !== project.slug) {
    slug = await uniqueSlug(patch.slug);
  }
  const obfuscate =
    patch.obfuscate === undefined ? Boolean(project.obfuscate) : Boolean(patch.obfuscate);
  await sql.query(
    `update projects set name = $1, description = $2, slug = $3, obfuscate = $4, updated_at = now()
     where id = $5 and owner_id = $6`,
    [name, description, slug, obfuscate, projectId, userId],
  );
  await writeAudit(userId, projectId, "project.update", { name, slug, obfuscate });
  return getProjectForUser(userId, projectId);
}

export async function archiveProject(
  userId: string,
  projectId: string,
): Promise<void> {
  await requireOwnedProject(userId, projectId);
  const sql = await getSql();
  await sql.query(
    `update projects set status = 'archived', updated_at = now()
     where id = $1 and owner_id = $2`,
    [projectId, userId],
  );
  await writeAudit(userId, projectId, "project.archive", {});
}

export async function deleteProject(
  userId: string,
  projectId: string,
): Promise<void> {
  await requireOwnedProject(userId, projectId);
  const sql = await getSql();
  await sql.query(`delete from projects where id = $1 and owner_id = $2`, [
    projectId,
    userId,
  ]);
  await writeAudit(userId, projectId, "project.delete", {});
}

export async function restoreStatus(
  userId: string,
  projectId: string,
  status: ProjectStatus,
): Promise<ProjectSummary> {
  await requireOwnedProject(userId, projectId);
  const sql = await getSql();
  await sql.query(
    `update projects set status = $1, updated_at = now() where id = $2 and owner_id = $3`,
    [status, projectId, userId],
  );
  return getProjectForUser(userId, projectId);
}
