import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "600",
};

export const Route = createFileRoute("/x/$rid")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ params, request }) => handle(params.rid, request),
      POST: async ({ params, request }) => handle(params.rid, request),
    },
  },
});

async function handle(rid: string, request: Request): Promise<Response> {
  const { serveRuntimeBeacon } = await import("@/lib/server/beacon.server");
  const result = await serveRuntimeBeacon(rid, request);
  const headers: Record<string, string> = {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...CORS,
  };
  if (result.status === 429) headers["Retry-After"] = "20";
  return new Response(result.body, { status: result.status, headers });
}
