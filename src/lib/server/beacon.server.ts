import { getSql } from "@/lib/db";
import { recordExecution, recordLog, recordRuntimeError } from "./analytics.server";
import { regionFrom } from "./origin.server";
import { deriveWrapKey, formatKeyChunk } from "./protect.server";
import { clientKey, rateLimit } from "./rate-limit.server";
import { RateLimitError } from "./errors.server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type BeaconResult = { status: 200 | 404 | 429; body: string };

export async function serveRuntimeBeacon(
  runtimeId: string,
  request: Request,
): Promise<BeaconResult> {
  if (!UUID_RE.test(runtimeId)) {
    return { status: 404, body: "-- 404\n" };
  }

  try {
    rateLimit(clientKey(request, `x:${runtimeId}`), 180, 60_000);
    rateLimit(`x-id:${runtimeId}`, 400, 60_000);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return { status: 429, body: "-- 429\n" };
    }
    throw err;
  }

  const sql = await getSql();
  const rows = await sql.query<{
    project_id: string;
    version_id: string;
    wrap_seed: string;
    status: string;
  }>(
    `select p.id as project_id, p.status, p.wrap_seed, p.published_version_id as version_id
     from projects p
     where p.runtime_id = $1`,
    [runtimeId],
  );
  const row = rows[0];
  if (!row || row.status !== "published" || !row.version_id) {
    return { status: 404, body: "-- 404\n" };
  }

  const url = new URL(request.url);
  const isError = url.searchParams.get("e") === "1";
  const ua = request.headers.get("user-agent");
  const region = regionFrom(request);

  let postBody: { kind?: string; message?: string } | null = null;
  if (request.method === "POST") {
    try {
      const text = await request.text();
      if (text) postBody = JSON.parse(text) as { kind?: string; message?: string };
    } catch {
      postBody = { kind: "boot" };
    }
  }

  if (isError) {
    await recordRuntimeError({
      projectId: row.project_id,
      versionId: row.version_id,
      userAgent: ua,
      region,
    });
    return { status: 200, body: "-- ok\n" };
  }

  if (postBody) {
    const kind = (postBody.kind || "log").slice(0, 40);
    await recordLog({
      projectId: row.project_id,
      versionId: row.version_id,
      kind,
      message: postBody.message ?? "script reporter",
      statusCode: 200,
      region,
      userAgent: ua,
    });
    return { status: 200, body: "-- ok\n" };
  }

  await recordExecution({
    projectId: row.project_id,
    versionId: row.version_id,
    statusCode: 200,
    userAgent: ua,
    region,
  });

  const key = deriveWrapKey(row.wrap_seed, row.version_id);
  return { status: 200, body: formatKeyChunk(key) };
}
