import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Plus } from "lucide-react";
import { getOverview, listAuditFn, listProjects } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/projects/project-card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, relativeTime } from "@/lib/utils";
import { useCurrentSiteUser } from "@/lib/site-session";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const user = useCurrentSiteUser();
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => listProjects() });
  const overview = useQuery({ queryKey: ["overview"], queryFn: () => getOverview() });
  const audit = useQuery({
    queryKey: ["audit"],
    queryFn: () => listAuditFn({ data: {} }),
  });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] tracking-wide text-subtle uppercase">
            Dashboard
          </p>
          <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">
            {user?.displayName ? `Hello, ${user.displayName}` : "Your scripts"}
          </h1>
        </div>
        <Button asChild>
          <Link to="/projects/new">
            <Plus className="size-4" />
            New project
          </Link>
        </Button>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Projects", overview.data?.projects],
          ["Published", overview.data?.published],
          ["Runtime executions", overview.data?.executions],
          ["Endpoint fetches", overview.data?.fetches],
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

      <div className="mt-10 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Projects</h2>
        <Link to="/projects" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
          All projects <ArrowRight className="size-3.5" />
        </Link>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {projects.isLoading
          ? Array.from({ length: 2 }, (_, i) => (
              <Skeleton key={i} className="h-48 rounded-[var(--radius-xl)]" />
            ))
          : (projects.data ?? []).slice(0, 4).map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
      </div>
      {!projects.isLoading && (projects.data?.length ?? 0) === 0 ? (
        <EmptyProjects />
      ) : null}

      <h2 className="font-display mt-12 text-lg font-semibold">Source access log</h2>
      <p className="mt-1 text-sm text-muted">
        Reads of private source from your session. Other users never appear here
        because they cannot load the file.
      </p>
      <ul className="mt-4 divide-y divide-border rounded-[var(--radius-lg)] bg-bg-elevated shadow-[var(--shadow-border)]">
        {(audit.data ?? []).slice(0, 8).map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <span className="font-mono text-xs text-muted">{row.action}</span>
            <span className="text-subtle">{relativeTime(row.createdAt)}</span>
          </li>
        ))}
        {!audit.isLoading && (audit.data?.length ?? 0) === 0 ? (
          <li className="px-4 py-6 text-sm text-muted">No audited access yet.</li>
        ) : null}
      </ul>
    </div>
  );
}

function EmptyProjects() {
  return (
    <div className="rounded-[var(--radius-xl)] bg-bg-elevated p-8 text-center shadow-[var(--shadow-border)]">
      <h3 className="font-display text-xl font-semibold">No projects yet</h3>
      <p className="mt-2 text-sm text-muted">
        Create a Luau project. Source stays private until you publish a raw endpoint.
      </p>
      <Button className="mt-5" asChild>
        <Link to="/projects/new">Create project</Link>
      </Button>
    </div>
  );
}
