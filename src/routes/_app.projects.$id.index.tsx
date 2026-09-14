import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  getProject,
  listAuditFn,
  listVersions,
  publishVersionFn,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { formatNumber, loadstringSnippet, relativeTime } from "@/lib/utils";

export const Route = createFileRoute("/_app/projects/$id/")({
  component: ProjectOverview,
});

function ProjectOverview() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const project = useQuery({
    queryKey: ["project", id],
    queryFn: () => getProject({ data: { id } }),
  });
  const versions = useQuery({
    queryKey: ["versions", id],
    queryFn: () => listVersions({ data: { projectId: id } }),
  });
  const audit = useQuery({
    queryKey: ["audit", id],
    queryFn: () => listAuditFn({ data: { projectId: id } }),
  });
  const [copied, setCopied] = useState<"url" | "lua" | null>(null);
  const [pinging, setPinging] = useState(false);
  const p = project.data;
  if (!p) return null;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const rawUrl = `${origin}/raw/${p.slug}`;
  const snippet = loadstringSnippet(origin, p.slug);
  const current = versions.data?.find((v) => v.isPublished) ?? versions.data?.[0];

  const copy = async (kind: "url" | "lua", text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1200);
  };

  const testPing = async () => {
    if (p.status !== "published") {
      toast.error("Publish a version first. The beacon only unwraps published scripts.");
      return;
    }
    setPinging(true);
    try {
      const res = await fetch(`${origin}/x/${p.runtimeId}`, { method: "GET" });
      const body = await res.text();
      if (!res.ok) {
        toast.error(`Beacon returned ${res.status}`);
        return;
      }
      if (!body.startsWith("return{")) {
        toast.error("Beacon did not return unwrap material");
        return;
      }
      toast.success("Runtime ping recorded. Open analytics to see +1.");
      await qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ping failed");
    } finally {
      setPinging(false);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 md:grid-cols-[1.2fr_0.8fr] md:px-8">
      <div className="space-y-6">
        <section className="rounded-[var(--radius-xl)] bg-bg-elevated p-5 shadow-[var(--shadow-border)]">
          <p className="font-mono text-[11px] tracking-wide text-subtle uppercase">
            Raw endpoint
          </p>
          <p className="mt-2 break-all font-mono text-sm text-muted">{rawUrl}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => copy("url", rawUrl)}>
              {copied === "url" ? <Check className="size-4" /> : <Copy className="size-4" />}
              Copy URL
            </Button>
            <Button size="sm" variant="outline" onClick={() => copy("lua", snippet)}>
              {copied === "lua" ? <Check className="size-4" /> : <Copy className="size-4" />}
              Copy loadstring
            </Button>
            <Button size="sm" asChild>
              <Link to="/projects/$id/edit" params={{ id }}>
                Edit source
              </Link>
            </Button>
            {current && !current.isPublished ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  try {
                    await publishVersionFn({
                      data: { projectId: id, versionId: current.id },
                    });
                    toast.success(`Published v${current.version}`);
                    await qc.invalidateQueries();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Publish failed");
                  }
                }}
              >
                Publish v{current.version}
              </Button>
            ) : null}
          </div>
          <pre className="mt-5 overflow-x-auto rounded-[var(--radius-md)] bg-bg-subtle p-4 font-mono text-[12px] text-muted">
            {snippet}
          </pre>
        </section>
        <section className="grid gap-3 sm:grid-cols-3">
          {[
            ["Runtime executions", formatNumber(p.executionCount)],
            ["Endpoint fetches", formatNumber(p.fetchCount)],
            ["Updated", relativeTime(p.updatedAt)],
          ].map(([k, v]) => (
            <div
              key={k}
              className="rounded-[var(--radius-lg)] bg-bg-elevated p-4 shadow-[var(--shadow-border)]"
            >
              <p className="font-mono text-[11px] tracking-wide text-subtle uppercase">
                {k}
              </p>
              <p className="mt-1 text-lg font-medium tabular-nums">{v}</p>
            </div>
          ))}
        </section>
        <section className="rounded-[var(--radius-xl)] bg-bg-elevated p-5 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-base font-semibold">Test the runtime beacon</h2>
          <p className="mt-2 text-sm text-muted">
            This hits the same /x path a player hits when the script launches. It
            increments the real execution counter. It is not simulated traffic.
          </p>
          <Button className="mt-4" size="sm" onClick={testPing} disabled={pinging}>
            {pinging ? "Pinging…" : "Send a test runtime ping"}
          </Button>
        </section>
      </div>
      <aside className="space-y-6">
        <section className="rounded-[var(--radius-xl)] bg-bg-elevated p-5 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-base font-semibold">Protected payload</h2>
          <p className="mt-2 text-sm text-muted">
            Only you can open plaintext through the website. /raw serves a UUID-keyed
            wrapper with the credit header. The unwrap key is released at runtime,
            for any player, with no account lock.
          </p>
          {p.status === "published" ? (
            <a
              href={rawUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-sm text-muted underline underline-offset-4 hover:text-fg"
            >
              View published payload
            </a>
          ) : (
            <p className="mt-3 text-sm text-subtle">Publish to attach /raw.</p>
          )}
        </section>
        <section className="rounded-[var(--radius-xl)] bg-bg-elevated p-5 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-base font-semibold">Recent access</h2>
          <ul className="mt-3 space-y-2">
            {(audit.data ?? []).slice(0, 6).map((row) => (
              <li key={row.id} className="flex justify-between gap-2 font-mono text-[11px] text-muted">
                <span>{row.action}</span>
                <span>{relativeTime(row.createdAt)}</span>
              </li>
            ))}
            {(audit.data?.length ?? 0) === 0 ? (
              <li className="text-sm text-muted">No source reads yet.</li>
            ) : null}
          </ul>
        </section>
      </aside>
    </div>
  );
}
