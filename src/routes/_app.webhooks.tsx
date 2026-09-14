import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { listAllWebhooksFn } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { relativeTime } from "@/lib/utils";

export const Route = createFileRoute("/_app/webhooks")({
  component: WebhooksIndex,
});

function WebhooksIndex() {
  const hooks = useQuery({
    queryKey: ["webhooks-all"],
    queryFn: () => listAllWebhooksFn(),
  });
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8">
      <p className="font-mono text-[11px] tracking-wide text-subtle uppercase">
        Webhooks
      </p>
      <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">
        Delivery endpoints
      </h1>
      <p className="mt-2 text-sm text-muted">
        Secrets are never returned after creation. Configure events on the project.
      </p>
      <ul className="mt-8 space-y-3">
        {(hooks.data ?? []).map((hook) => (
          <li
            key={hook.id}
            className="rounded-[var(--radius-xl)] bg-bg-elevated p-5 shadow-[var(--shadow-border)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{hook.name}</p>
                <Link
                  to="/projects/$id/webhooks"
                  params={{ id: hook.projectId }}
                  className="text-sm text-muted hover:text-fg"
                >
                  {hook.projectName}
                </Link>
              </div>
              <Badge variant={hook.enabled ? "published" : "draft"}>
                {hook.enabled ? "On" : "Off"}
              </Badge>
            </div>
            <p className="mt-2 break-all font-mono text-xs text-subtle">{hook.endpoint}</p>
            <p className="mt-2 text-xs text-muted">
              {hook.lastFiredAt
                ? `Last ${hook.lastStatus} · ${relativeTime(hook.lastFiredAt)}`
                : "Never fired"}
            </p>
          </li>
        ))}
        {!hooks.isLoading && (hooks.data?.length ?? 0) === 0 ? (
          <li className="text-sm text-muted">No webhooks yet.</li>
        ) : null}
      </ul>
    </div>
  );
}
