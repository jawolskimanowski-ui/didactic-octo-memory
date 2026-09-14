import { getSql } from "@/lib/db";
import { makeId } from "./ids.server";

export async function writeAudit(
  userId: string,
  projectId: string | null,
  action: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const sql = await getSql();
  const id = makeId("aud");
  const meta = JSON.stringify(metadata);
  await sql`
    insert into audit_logs (id, user_id, project_id, action, metadata)
    values (${id}, ${userId}, ${projectId}, ${action}, ${meta})
  `;
}

export async function listAuditForOwner(userId: string, projectId?: string, limit = 50) {
  const sql = await getSql();
  if (projectId) {
    return sql<{
      id: string;
      action: string;
      project_id: string | null;
      metadata: string;
      created_at: string;
    }>`
      select id, action, project_id, metadata, created_at::text as created_at
      from audit_logs
      where user_id = ${userId} and project_id = ${projectId}
      order by created_at desc
      limit ${limit}
    `;
  }
  return sql<{
    id: string;
    action: string;
    project_id: string | null;
    metadata: string;
    created_at: string;
  }>`
    select id, action, project_id, metadata, created_at::text as created_at
    from audit_logs
    where user_id = ${userId}
    order by created_at desc
    limit ${limit}
  `;
}
