import { getSql } from "@/lib/db";
import { ForbiddenError, NotFoundError } from "./errors.server";
import type { ProjectStatus } from "@/lib/types";

export type ProjectRow = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string;
  status: ProjectStatus;
  current_version_id: string | null;
  published_version_id: string | null;
  runtime_id: string;
  execution_count: number;
  fetch_count: number;
  error_count: number;
  obfuscate: boolean;
  created_at: string;
  updated_at: string;
};

const PROJECT_COLS = `
  id, owner_id, name, slug, description, status,
  current_version_id, published_version_id, runtime_id,
  execution_count, fetch_count, error_count, obfuscate,
  created_at::text as created_at,
  updated_at::text as updated_at
`;

export async function requireOwnedProject(
  userId: string,
  projectId: string,
): Promise<ProjectRow> {
  const sql = await getSql();
  const rows = await sql.query<ProjectRow>(
    `select ${PROJECT_COLS} from projects where id = $1`,
    [projectId],
  );
  const project = rows[0];
  if (!project) throw new NotFoundError();
  if (project.owner_id !== userId) throw new ForbiddenError();
  return project;
}

export async function findOwnedProjectBySlug(
  userId: string,
  slug: string,
): Promise<ProjectRow | null> {
  const sql = await getSql();
  const rows = await sql.query<ProjectRow>(
    `select ${PROJECT_COLS} from projects where slug = $1 and owner_id = $2`,
    [slug, userId],
  );
  return rows[0] ?? null;
}

export { PROJECT_COLS };
