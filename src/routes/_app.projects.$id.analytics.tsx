import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { getAnalytics } from "@/lib/api";
import { ExecutionsChart } from "@/components/charts/executions-chart";
import { formatNumber, relativeTime } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_app/projects/$id/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { id } = Route.useParams();
  const q = useQuery({
    queryKey: ["analytics", id],
    queryFn: () => getAnalytics({ data: { projectId: id } }),
  });
  const a = q.data;
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <p className="text-sm text-muted">
        Runtime executions are recorded when the injected beacon at /x/uuid
        runs inside a player. Fetching /raw does not increment this counter. No
        IP addresses or Roblox user ids are stored.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Runtime executions", a?.total],
          ["Today", a?.today],
          ["This week", a?.week],
          ["Endpoint fetches (30d)", a?.fetchesMonth],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-[var(--radius-lg)] bg-bg-elevated p-4 shadow-[var(--shadow-border)]"
          >
            <p className="font-mono text-[11px] tracking-wide text-subtle uppercase">
              {label}
            </p>
            {q.isLoading ? (
              <Skeleton className="mt-2 h-8 w-20" />
            ) : (
              <p className="font-display mt-1 text-2xl font-semibold tabular-nums">
                {typeof value === "number" ? formatNumber(value) : value}
              </p>
            )}
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-[var(--radius-xl)] bg-bg-elevated p-5 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-base font-semibold">Last 30 days</h2>
        <p className="mt-1 text-sm text-muted">
          Zero-filled days are days with no runtime pings — not estimated traffic.
        </p>
        {a ? <ExecutionsChart data={a.series} /> : <Skeleton className="mt-4 h-56" />}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <ListCard
          title="Runtime status"
          rows={(a?.statuses ?? []).map((s) => [`${s.status}`, s.count])}
        />
        <ListCard
          title="Version usage"
          rows={(a?.versions ?? []).map((s) => [s.version, s.count])}
        />
        <ListCard
          title="Regions"
          rows={(a?.regions ?? []).map((s) => [s.region, s.count])}
        />
      </div>
      <div className="mt-6 rounded-[var(--radius-xl)] bg-bg-elevated p-5 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-base font-semibold">Recent activity</h2>
        <p className="mt-1 text-sm text-muted">
          Error rate (30d): {a ? `${Math.round(a.errorRate * 1000) / 10}%` : "—"}
          {" · "}
          Current version: {a?.currentVersion ? `v${a.currentVersion}` : "—"}
        </p>
        <ul className="mt-4 divide-y divide-border">
          {(a?.recent ?? []).map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2 font-mono text-xs text-muted">
              <span>{row.eventType}</span>
              <span>{row.statusCode}</span>
              <span>{row.region ?? "—"}</span>
              <span>{relativeTime(row.createdAt)}</span>
            </li>
          ))}
          {!q.isLoading && (a?.recent.length ?? 0) === 0 ? (
            <li className="py-4 text-sm text-muted">
              No events yet. Run the loadstring on a player, or send a test runtime ping from the project overview.
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

function ListCard({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <div className="rounded-[var(--radius-xl)] bg-bg-elevated p-5 shadow-[var(--shadow-border)]">
      <h2 className="font-display text-base font-semibold">{title}</h2>
      <ul className="mt-3 space-y-2">
        {rows.map(([k, v]) => (
          <li key={k} className="flex justify-between text-sm">
            <span className="text-muted">{k}</span>
            <span className="font-mono tabular-nums">{formatNumber(v)}</span>
          </li>
        ))}
        {rows.length === 0 ? <li className="text-sm text-muted">No data yet.</li> : null}
      </ul>
    </div>
  );
}
