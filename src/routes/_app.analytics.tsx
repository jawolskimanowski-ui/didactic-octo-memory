import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getOverview, listProjects } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_app/analytics")({
  component: GlobalAnalytics,
});

function GlobalAnalytics() {
  const overview = useQuery({ queryKey: ["overview"], queryFn: () => getOverview() });
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => listProjects() });
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <p className="font-mono text-[11px] tracking-wide text-subtle uppercase">
        Analytics
      </p>
      <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">
        Across your projects
      </h1>
      <p className="mt-2 text-sm text-muted">
        Runtime executions only — counted when the injected beacon runs. Endpoint
        fetches are listed separately and are not mixed into this total.
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Runtime executions", overview.data?.executions],
          ["Endpoint fetches", overview.data?.fetches],
          ["Errors", overview.data?.errors],
          ["Published", overview.data?.published],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-[var(--radius-lg)] bg-bg-elevated p-4 shadow-[var(--shadow-border)]"
          >
            <p className="font-mono text-[11px] tracking-wide text-subtle uppercase">
              {label}
            </p>
            {overview.isLoading ? (
              <Skeleton className="mt-2 h-8 w-16" />
            ) : (
              <p className="font-display mt-1 text-2xl font-semibold tabular-nums">
                {formatNumber(Number(value) || 0)}
              </p>
            )}
          </div>
        ))}
      </div>
      <ul className="mt-8 divide-y divide-border rounded-[var(--radius-xl)] bg-bg-elevated shadow-[var(--shadow-border)]">
        {(projects.data ?? []).map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <Link
                to="/projects/$id/analytics"
                params={{ id: p.id }}
                className="font-medium hover:underline"
              >
                {p.name}
              </Link>
              <p className="font-mono text-xs text-subtle">/{p.slug}</p>
            </div>
            <p className="font-mono text-sm tabular-nums text-muted">
              {formatNumber(p.executionCount)} executions · {formatNumber(p.fetchCount)} fetches
            </p>
          </li>
        ))}
        {!projects.isLoading && (projects.data?.length ?? 0) === 0 ? (
          <li className="px-5 py-8 text-sm text-muted">No projects yet.</li>
        ) : null}
      </ul>
    </div>
  );
}
