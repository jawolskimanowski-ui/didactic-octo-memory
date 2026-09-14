import { createServerFn } from "@tanstack/react-start";
import { actorMiddleware } from "@/lib/actor-middleware";
import type { WebhookDraft, WebhookKind, WebhookPayloadMode } from "@/lib/types";

async function noStore() {
  try {
    const { setResponseHeader } = await import("@tanstack/react-start/server");
    setResponseHeader("cache-control" as "cache-control", "no-store");
    setResponseHeader("vary" as "vary", "Cookie, Authorization");
  } catch {
    /* header helper is unavailable in some runtimes */
  }
}

export const getMe = createServerFn({ method: "GET" }).handler(async () => {
  await noStore();
  const { resolveActor, GUEST_DEPLOY_LIMIT: limit } = await import("./server/actor.server");
  const actor = await resolveActor({ createGuest: false });
  if (!actor) return null;
  return {
    userId: actor.userId,
    kind: actor.kind,
    displayName: actor.displayName,
    nameCustomized: actor.nameCustomized,
    uuid: await (await import("./server/site-auth.server")).getUuidForUser(actor.userId),
    handle: actor.handle,
    bio: actor.bio,
    avatarHue: actor.avatarHue,
    isGuest: actor.isGuest,
    publishedCount: actor.publishedCount,
    projectCount: actor.projectCount,
    remainingDeploys: actor.remainingDeploys,
    guestLimit: limit,
  };
});

export const continueAsGuestFn = createServerFn({ method: "POST" }).handler(async () => {
  await noStore();
  const { continueAsGuest, GUEST_DEPLOY_LIMIT: limit } = await import("./server/actor.server");
  const actor = await continueAsGuest();
  return { ...actor, guestLimit: limit };
});

export const fetchSessionUser = createServerFn({ method: "GET" }).handler(async () => {
  await noStore();
  const { resolveActor } = await import("./server/actor.server");
  const actor = await resolveActor({ createGuest: false });
  return actor ? { id: actor.userId, uuid: await (await import("./server/site-auth.server")).getUuidForUser(actor.userId) } : null;
});

export const bootstrapAccountFn = createServerFn({ method: "POST" }).handler(async () => {
  await noStore();
  const { bootstrapSiteAccount } = await import("./server/site-auth.server");
  return bootstrapSiteAccount();
});

export const signInUuidFn = createServerFn({ method: "POST" })
  .validator((data: { uuid: string; password: string }) => data)
  .handler(async ({ data }) => {
    await noStore();
    const { signInWithUuid } = await import("./server/site-auth.server");
    const actor = await signInWithUuid(data.uuid, data.password);
    const { getUuidForUser } = await import("./server/site-auth.server");
    return { actor, uuid: await getUuidForUser(actor.userId) };
  });

export const rotateUuidFn = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .handler(async ({ context }) => {
    await noStore();
    const { rotateLoginUuid } = await import("./server/site-auth.server");
    return { uuid: await rotateLoginUuid(context.userId) };
  });

export const changePasswordFn = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator((data: { currentPassword: string; newPassword: string }) => data)
  .handler(async ({ context, data }) => {
    await noStore();
    const { changePasswordForUser } = await import("./server/site-auth.server");
    await changePasswordForUser(context.userId, data.currentPassword, data.newPassword);
    return { ok: true };
  });

export const getCredentialsFn = createServerFn({ method: "GET" })
  .middleware([actorMiddleware])
  .handler(async ({ context }) => {
    await noStore();
    const { getUuidForUser } = await import("./server/site-auth.server");
    return { uuid: await getUuidForUser(context.userId) };
  });

export const siteSignOutFn = createServerFn({ method: "POST" }).handler(async () => {
  await noStore();
  const { siteSignOut } = await import("./server/actor.server");
  await siteSignOut();
  return { ok: true };
});

export const updateProfileFn = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(
    (data: { displayName?: string; handle?: string | null; bio?: string; avatarHue?: number }) =>
      data,
  )
  .handler(async ({ context, data }) => {
    await noStore();
    const { updateProfileForActor } = await import("./server/actor.server");
    return updateProfileForActor(context.actor, data);
  });

export const listProjects = createServerFn({ method: "GET" })
  .middleware([actorMiddleware])
  .handler(async ({ context }) => {
    await noStore();
    const { ensureOnboarded } = await import("./server/onboarding.server");
    const { listProjectsForUser } = await import("./server/projects.server");
    if (!context.isGuest) await ensureOnboarded(context.userId);
    return listProjectsForUser(context.userId);
  });

export const getProject = createServerFn({ method: "GET" })
  .middleware([actorMiddleware])
  .validator((data: { id: string }) => data)
  .handler(async ({ context, data }) => {
    await noStore();
    const { getProjectForUser } = await import("./server/projects.server");
    return getProjectForUser(context.userId, data.id);
  });

export const createProject = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(
    (data: {
      name: string;
      description?: string;
      templateId?: string;
      obfuscate?: boolean;
      webhooks?: WebhookDraft[];
    }) => data,
  )
  .handler(async ({ context, data }) => {
    await noStore();
    const { assertCanCreateProject } = await import("./server/actor.server");
    await assertCanCreateProject(context.actor);
    const { createProjectForUser } = await import("./server/projects.server");
    const { templateById } = await import("./server/templates.server");
    const { createWebhookForUser } = await import("./server/webhooks.server");
    const source = data.templateId ? templateById(data.templateId) : undefined;
    const project = await createProjectForUser(context.userId, {
      name: data.name,
      description: data.description,
      source,
      obfuscate: data.obfuscate,
    });
    const secrets: string[] = [];
    for (const hook of data.webhooks ?? []) {
      if (!hook.endpoint.trim() || hook.endpoint.trim() === "https://") continue;
      const created = await createWebhookForUser(context.userId, project.id, {
        name: hook.name || "Webhook",
        endpoint: hook.endpoint,
        events: hook.events,
        kind: hook.kind,
        payloadMode: hook.payloadMode,
        discordUsername: hook.discordUsername,
        contentTemplate: hook.contentTemplate,
      });
      secrets.push(created.secret);
    }
    return { ...project, webhookSecrets: secrets };
  });

export const updateProject = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(
    (data: {
      id: string;
      name?: string;
      description?: string;
      slug?: string;
      obfuscate?: boolean;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    await noStore();
    const { updateProjectSettings } = await import("./server/projects.server");
    const { id, ...patch } = data;
    return updateProjectSettings(context.userId, id, patch);
  });

export const archiveProjectFn = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator((data: { id: string }) => data)
  .handler(async ({ context, data }) => {
    await noStore();
    const { archiveProject } = await import("./server/projects.server");
    await archiveProject(context.userId, data.id);
    return { ok: true };
  });

export const deleteProjectFn = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator((data: { id: string }) => data)
  .handler(async ({ context, data }) => {
    await noStore();
    const { deleteProject } = await import("./server/projects.server");
    await deleteProject(context.userId, data.id);
    return { ok: true };
  });

export const listTemplates = createServerFn({ method: "GET" }).handler(async () => {
  const { PUBLIC_TEMPLATES } = await import("./server/templates.server");
  return PUBLIC_TEMPLATES;
});

export const listVersions = createServerFn({ method: "GET" })
  .middleware([actorMiddleware])
  .validator((data: { projectId: string }) => data)
  .handler(async ({ context, data }) => {
    await noStore();
    const { listVersionsForUser } = await import("./server/versions.server");
    return listVersionsForUser(context.userId, data.projectId);
  });

export const getCurrentSource = createServerFn({ method: "GET" })
  .middleware([actorMiddleware])
  .validator((data: { projectId: string }) => data)
  .handler(async ({ context, data }) => {
    await noStore();
    const { getCurrentSourceForUser } = await import("./server/versions.server");
    return getCurrentSourceForUser(context.userId, data.projectId);
  });

export const getVersionSource = createServerFn({ method: "GET" })
  .middleware([actorMiddleware])
  .validator((data: { projectId: string; versionId: string }) => data)
  .handler(async ({ context, data }) => {
    await noStore();
    const { getVersionSourceForUser } = await import("./server/versions.server");
    return getVersionSourceForUser(context.userId, data.projectId, data.versionId);
  });

export const saveVersion = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(
    (data: {
      projectId: string;
      source: string;
      changelog?: string;
      bump?: "patch" | "minor" | "major";
      inPlace?: boolean;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    await noStore();
    const { saveNewVersion, saveDraftInPlace } = await import("./server/versions.server");
    if (data.inPlace) {
      return saveDraftInPlace(context.userId, data.projectId, {
        source: data.source,
        changelog: data.changelog,
      });
    }
    return saveNewVersion(context.userId, data.projectId, data);
  });

export const publishVersionFn = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator((data: { projectId: string; versionId: string }) => data)
  .handler(async ({ context, data }) => {
    await noStore();
    const { getProjectForUser } = await import("./server/projects.server");
    const { assertCanPublish } = await import("./server/actor.server");
    const project = await getProjectForUser(context.userId, data.projectId);
    await assertCanPublish(context.actor, project.status === "published");
    const { publishVersion } = await import("./server/versions.server");
    return publishVersion(context.userId, data.projectId, data.versionId);
  });

export const rollbackVersionFn = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator((data: { projectId: string; versionId: string }) => data)
  .handler(async ({ context, data }) => {
    await noStore();
    const { rollbackToVersion } = await import("./server/versions.server");
    return rollbackToVersion(context.userId, data.projectId, data.versionId);
  });

export const archiveVersionFn = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator((data: { projectId: string; versionId: string }) => data)
  .handler(async ({ context, data }) => {
    await noStore();
    const { archiveVersion } = await import("./server/versions.server");
    await archiveVersion(context.userId, data.projectId, data.versionId);
    return { ok: true };
  });

export const compareVersionsFn = createServerFn({ method: "GET" })
  .middleware([actorMiddleware])
  .validator((data: { projectId: string; leftId: string; rightId: string }) => data)
  .handler(async ({ context, data }) => {
    await noStore();
    const { compareVersionsForUser } = await import("./server/versions.server");
    return compareVersionsForUser(
      context.userId,
      data.projectId,
      data.leftId,
      data.rightId,
    );
  });

export const getAnalytics = createServerFn({ method: "GET" })
  .middleware([actorMiddleware])
  .validator((data: { projectId: string }) => data)
  .handler(async ({ context, data }) => {
    await noStore();
    const { getAnalyticsForUser } = await import("./server/analytics.server");
    return getAnalyticsForUser(context.userId, data.projectId);
  });

export const getOverview = createServerFn({ method: "GET" })
  .middleware([actorMiddleware])
  .handler(async ({ context }) => {
    await noStore();
    const { ensureOnboarded } = await import("./server/onboarding.server");
    const { getOwnerOverview } = await import("./server/analytics.server");
    if (!context.isGuest) await ensureOnboarded(context.userId);
    return getOwnerOverview(context.userId);
  });

export const listWebhooksFn = createServerFn({ method: "GET" })
  .middleware([actorMiddleware])
  .validator((data: { projectId: string }) => data)
  .handler(async ({ context, data }) => {
    await noStore();
    const { listWebhooksForUser } = await import("./server/webhooks.server");
    return listWebhooksForUser(context.userId, data.projectId);
  });

export const listAllWebhooksFn = createServerFn({ method: "GET" })
  .middleware([actorMiddleware])
  .handler(async ({ context }) => {
    await noStore();
    const { listAllWebhooksForUser } = await import("./server/webhooks.server");
    return listAllWebhooksForUser(context.userId);
  });

export const createWebhookFn = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(
    (data: {
      projectId: string;
      name: string;
      endpoint: string;
      events: string[];
      kind?: WebhookKind | "auto";
      payloadMode?: WebhookPayloadMode;
      discordUsername?: string;
      contentTemplate?: string;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    await noStore();
    const { createWebhookForUser } = await import("./server/webhooks.server");
    return createWebhookForUser(context.userId, data.projectId, data);
  });

export const updateWebhookFn = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator(
    (data: {
      projectId: string;
      webhookId: string;
      name?: string;
      endpoint?: string;
      events?: string[];
      enabled?: boolean;
      kind?: WebhookKind;
      payloadMode?: WebhookPayloadMode;
      discordUsername?: string;
      contentTemplate?: string;
    }) => data,
  )
  .handler(async ({ context, data }) => {
    await noStore();
    const { updateWebhookForUser } = await import("./server/webhooks.server");
    const { projectId, webhookId, ...patch } = data;
    return updateWebhookForUser(context.userId, projectId, webhookId, patch);
  });

export const deleteWebhookFn = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator((data: { projectId: string; webhookId: string }) => data)
  .handler(async ({ context, data }) => {
    await noStore();
    const { deleteWebhookForUser } = await import("./server/webhooks.server");
    await deleteWebhookForUser(context.userId, data.projectId, data.webhookId);
    return { ok: true };
  });

export const testWebhookFn = createServerFn({ method: "POST" })
  .middleware([actorMiddleware])
  .validator((data: { projectId: string; webhookId: string }) => data)
  .handler(async ({ context, data }) => {
    await noStore();
    const { testWebhookForUser } = await import("./server/webhooks.server");
    return testWebhookForUser(context.userId, data.projectId, data.webhookId);
  });

export const listAuditFn = createServerFn({ method: "GET" })
  .middleware([actorMiddleware])
  .validator((data: { projectId?: string } = {}) => data ?? {})
  .handler(async ({ context, data }) => {
    await noStore();
    const { listAuditForOwner } = await import("./server/audit.server");
    const { requireOwnedProject } = await import("./server/ownership.server");
    if (data.projectId) await requireOwnedProject(context.userId, data.projectId);
    const rows = await listAuditForOwner(context.userId, data.projectId);
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      projectId: r.project_id,
      metadata: r.metadata,
      createdAt: r.created_at,
    }));
  });

