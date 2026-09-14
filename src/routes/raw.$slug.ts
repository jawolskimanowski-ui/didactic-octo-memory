import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/raw/$slug")({
  server: {
    handlers: {
      OPTIONS: () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Max-Age": "600",
          },
        }),
      GET: async ({ params, request }) => {
        const { servePublishedSource } = await import("@/lib/server/raw.server");
        const result = await servePublishedSource(params.slug, request);
        if (!result.ok) {
          const message =
            result.status === 429
              ? "-- 429 too many requests\n"
              : "-- 404 published script not found\n";
          return new Response(message, {
            status: result.status,
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Cache-Control": "no-store",
              "Access-Control-Allow-Origin": "*",
              "X-Content-Type-Options": "nosniff",
              ...(result.status === 429 ? { "Retry-After": "20" } : {}),
            },
          });
        }
        return new Response(result.source, {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache",
            "Access-Control-Allow-Origin": "*",
            "X-Content-Type-Options": "nosniff",
            "X-Loadstring-Version": result.version,
          },
        });
      },
    },
  },
});
