import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/proxy/$slug")({
  server: {
    handlers: {
      OPTIONS: () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        }),
      POST: async ({ params, request }) => {
        const { clientKey, rateLimit } = await import("@/lib/server/rate-limit.server");
        try {
          rateLimit(clientKey(request, `proxy:${params.slug}`), 60, 60_000);
        } catch {
          return new Response(JSON.stringify({ error: "Too many requests" }), {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Retry-After": "20",
            },
          });
        }
        let body: unknown = null;
        try {
          const text = await request.text();
          body = text ? JSON.parse(text) : null;
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }
        try {
          const { proxyClientEvent } = await import("@/lib/server/webhooks.server");
          await proxyClientEvent(params.slug, body);
          return new Response(JSON.stringify({ ok: true }), {
            status: 202,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          });
        } catch {
          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }
      },
    },
  },
});
