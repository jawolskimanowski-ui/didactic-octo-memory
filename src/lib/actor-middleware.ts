import { createMiddleware } from "@tanstack/react-start";

/**
 * Resolves the caller for per-user data from the server-issued UUID account
 * cookie. Never trusts a client-supplied id.
 */
export const actorMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    return next({ sendContext: { bearerToken: undefined } });
  })
  .server(async ({ next, context }) => {
    const { requireActor } = await import("@/lib/server/actor.server");
    const actor = await requireActor(context.bearerToken);
    return next({
      context: {
        userId: actor.userId,
        isGuest: actor.isGuest,
        actor,
      },
    });
  });
