import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  createWebhookFn,
  deleteWebhookFn,
  listWebhooksFn,
  testWebhookFn,
  updateWebhookFn,
} from "@/lib/api";
import { WEBHOOK_EVENT_OPTIONS } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { relativeTime } from "@/lib/utils";

export const Route = createFileRoute("/_app/projects/$id/webhooks")({
  component: WebhooksPage,
});

function WebhooksPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const hooks = useQuery({
    queryKey: ["webhooks", id],
    queryFn: () => listWebhooksFn({ data: { projectId: id } }),
  });
  const [name, setName] = useState("Ops hook");
  const [endpoint, setEndpoint] = useState("https://");
  const [events, setEvents] = useState<string[]>(["execution", "error", "version_published"]);
  const [secretOnce, setSecretOnce] = useState<string | null>(null);

  const toggleEvent = (ev: string) => {
    setEvents((curr) =>
      curr.includes(ev) ? curr.filter((e) => e !== ev) : [...curr, ev],
    );
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8">
      <p className="text-sm text-muted">
        Choose <span className="font-medium text-fg">execution</span> to receive a signed event for every runtime execution, including the lifetime <span className="font-mono">totalExecutions</span> counter. Secrets stay encrypted on the server and never enter the Luau payload.
      </p>

      <form
        className="mt-6 space-y-3 rounded-[var(--radius-xl)] bg-bg-elevated p-5 shadow-[var(--shadow-border)]"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const created = await createWebhookFn({
              data: { projectId: id, name, endpoint, events },
            });
            setSecretOnce(created.secret);
            toast.success("Webhook created — copy the secret now");
            await qc.invalidateQueries({ queryKey: ["webhooks", id] });
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not create webhook");
          }
        }}
      >
        <h2 className="font-display text-base font-semibold">Add webhook</h2>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wh-name">Name</Label>
          <Input id="wh-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wh-url">Endpoint</Label>
          <Input
            id="wh-url"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="https://example.com/hook"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {WEBHOOK_EVENT_OPTIONS.map((ev) => (
            <button
              key={ev.id}
              type="button"
              onClick={() => toggleEvent(ev.id)}
              className={
                events.includes(ev.id)
                  ? "rounded-full bg-accent px-3 py-1 text-xs text-accent-fg"
                  : "rounded-full bg-bg-subtle px-3 py-1 text-xs text-muted"
              }
            >
              {ev.label}
            </button>
          ))}
        </div>
        <Button type="submit">Add webhook</Button>
        {secretOnce ? (
          <p className="rounded-[var(--radius-sm)] bg-bg-subtle p-3 font-mono text-xs break-all">
            Secret (shown once): {secretOnce}
          </p>
        ) : null}
      </form>

      <ul className="mt-6 space-y-3">
        {(hooks.data ?? []).map((hook) => (
          <li
            key={hook.id}
            className="rounded-[var(--radius-xl)] bg-bg-elevated p-5 shadow-[var(--shadow-border)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{hook.name}</p>
                <p className="mt-1 break-all font-mono text-xs text-muted">
                  {hook.endpoint}
                </p>
                <p className="mt-2 text-xs text-subtle">
                  ending {hook.secretSuffix} · {hook.events.join(", ")}
                </p>
              </div>
              <Switch
                checked={hook.enabled}
                onCheckedChange={async (enabled) => {
                  await updateWebhookFn({
                    data: { projectId: id, webhookId: hook.id, enabled },
                  });
                  await qc.invalidateQueries({ queryKey: ["webhooks", id] });
                }}
              />
            </div>
            <p className="mt-3 text-xs text-muted">
              Last delivery{" "}
              {hook.lastFiredAt
                ? `${hook.lastStatus ?? "—"} · ${relativeTime(hook.lastFiredAt)}`
                : "never"}
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    const res = await testWebhookFn({
                      data: { projectId: id, webhookId: hook.id },
                    });
                    toast.message(`Test status ${res.status || "failed"}`);
                    await qc.invalidateQueries({ queryKey: ["webhooks", id] });
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Test failed");
                  }
                }}
              >
                Test
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={async () => {
                  await deleteWebhookFn({
                    data: { projectId: id, webhookId: hook.id },
                  });
                  toast.success("Removed");
                  await qc.invalidateQueries({ queryKey: ["webhooks", id] });
                }}
              >
                Remove
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
