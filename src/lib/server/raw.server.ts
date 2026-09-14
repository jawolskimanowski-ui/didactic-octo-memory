import { getSql } from "@/lib/db";
import { recordFetch } from "./analytics.server";
import { publicOrigin, regionFrom } from "./origin.server";
import { wrapPublishedSource } from "./protect.server";
import { clientKey, rateLimit } from "./rate-limit.server";
import { RateLimitError } from "./errors.server";

export type RawResult =
  | { ok: true; source: string; version: string; projectId: string; versionId: string }
  | { ok: false; status: 404 | 429 };

export async function servePublishedSource(
  slug: string,
  request: Request,
): Promise<RawResult> {
  try {
    rateLimit(clientKey(request, `raw:${slug}`), 240, 60_000);
  } catch (err) {
    if (err instanceof RateLimitError) {
      const sql = await getSql();
      const proj = await sql.query<{ id: string }>(
        `select id from projects where slug = $1`,
        [slug],
      );
      if (proj[0]) {
        await recordFetch({
          projectId: proj[0].id,
          versionId: null,
          statusCode: 429,
          userAgent: request.headers.get("user-agent"),
          region: regionFrom(request),
        });
      }
      return { ok: false, status: 429 };
    }
    throw err;
  }

  const sql = await getSql();
  const rows = await sql.query<{
    project_id: string;
    version_id: string;
    version: string;
    source_code: string;
    status: string;
    runtime_id: string;
    wrap_seed: string;
    obfuscate: boolean;
  }>(
    `select p.id as project_id, p.status, p.runtime_id, p.wrap_seed, p.obfuscate,
            v.id as version_id, v.version, v.source_code
     from projects p
     join script_versions v on v.id = p.published_version_id
     where p.slug = $1 and p.status = 'published' and v.is_published = true`,
    [slug],
  );
  const row = rows[0];
  if (!row) {
    const missing = await sql.query<{ id: string }>(
      `select id from projects where slug = $1`,
      [slug],
    );
    if (missing[0]) {
      await recordFetch({
        projectId: missing[0].id,
        versionId: null,
        statusCode: 404,
        userAgent: request.headers.get("user-agent"),
        region: regionFrom(request),
      });
    }
    return { ok: false, status: 404 };
  }

  await recordFetch({
    projectId: row.project_id,
    versionId: row.version_id,
    statusCode: 200,
    userAgent: request.headers.get("user-agent"),
    region: regionFrom(request),
  });

  const wrapped = wrapPublishedSource({
    source: row.source_code,
    origin: publicOrigin(request),
    runtimeId: row.runtime_id,
    wrapSeed: row.wrap_seed,
    versionId: row.version_id,
    obfuscate: Boolean(row.obfuscate),
  });

  return {
    ok: true,
    source: wrapped.lua,
    version: row.version,
    projectId: row.project_id,
    versionId: row.version_id,
  };
}
