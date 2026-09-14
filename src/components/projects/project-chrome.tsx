import { Link, Outlet, useParams, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getProject } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorPage } from "@/components/errors/error-page";
import { cn } from "@/lib/utils";
import type { ProjectSummary } from "@/lib/types";

const TABS = [
  { to: "/projects/$id", label: "Overview", suffix: "" },
  { to: "/projects/$id/edit", label: "Source", suffix: "/edit" },
  { to: "/projects/$id/versions", label: "Versions", suffix: "/versions" },
  { to: "/projects/$id/analytics", label: "Analytics", suffix: "/analytics" },
  { to: "/projects/$id/webhooks", label: "Webhooks", suffix: "/webhooks" },
  { to: "/projects/$id/settings", label: "Settings", suffix: "/settings" },
] as const;

export function ProjectChrome() {
  const { id } = useParams({ strict: false }) as { id: string };
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const query = useQuery({
    queryKey: ["project", id],
    queryFn: () => getProject({ data: { id } }),
  });

  if (query.isLoading) {
    return (
      <div className="px-4 py-8 md:px-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-10 w-full max-w-xl" />
      </div>
    );
  }
  if (query.error) {
    const message = query.error instanceof Error ? query.error.message : "";
    if (message === "Unauthorized") return <ErrorPage code={401} />;
    if (message === "Access denied") return <ErrorPage code={403} />;
    return <ErrorPage code={404} />;
  }
  const project = query.data!;
  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b border-border px-4 pt-6 md:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {project.name}
          </h1>
          <Badge
            variant={
              project.status === "published"
                ? "published"
                : project.status === "archived"
                  ? "archived"
                  : "draft"
            }
          >
            {project.status}
          </Badge>
          <span className="font-mono text-xs text-muted">
            {project.publishedVersion
              ? `v${project.publishedVersion}`
              : project.currentVersion
                ? `v${project.currentVersion}`
                : "no version"}
          </span>
        </div>
        <div className="mt-4 flex gap-1 overflow-x-auto pb-px">
          {TABS.map((tab) => {
            const href = `/projects/${id}${tab.suffix}`;
            const active =
              tab.suffix === ""
                ? pathname === href
                : pathname.startsWith(href);
            return (
              <Link
                key={tab.suffix}
                to={tab.to}
                params={{ id }}
                className={cn(
                  "h-11 shrink-0 px-3 text-sm",
                  active
                    ? "border-b border-fg text-fg"
                    : "border-b border-transparent text-muted hover:text-fg",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}

export function useProjectId() {
  return useParams({ from: "/_app/projects/$id" }).id;
}

export type { ProjectSummary };
