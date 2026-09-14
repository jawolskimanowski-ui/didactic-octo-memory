import { Link } from "@tanstack/react-router";
import { Activity, Clock3, Code2, Settings2 } from "lucide-react";
import type { ProjectSummary } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCompact, relativeTime } from "@/lib/utils";

function statusVariant(status: ProjectSummary["status"]) {
  if (status === "published") return "published" as const;
  if (status === "archived") return "archived" as const;
  return "draft" as const;
}

export function ProjectCard({ project }: { project: ProjectSummary }) {
  const version = project.publishedVersion ?? project.currentVersion ?? "—";
  return (
    <article className="flex flex-col rounded-[var(--radius-xl)] bg-bg-elevated p-5 shadow-[var(--shadow-border)] transition-[box-shadow] duration-150 hover:shadow-[var(--shadow-border-hover)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold tracking-tight">
            {project.name}
          </h3>
          <p className="mt-1 font-mono text-xs text-subtle">/{project.slug}</p>
        </div>
        <Badge variant={statusVariant(project.status)}>{project.status}</Badge>
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-muted">
        {project.description || "No description"}
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-xs text-muted">
        <span>v{version}</span>
        <span className="tabular-nums">
          {formatCompact(project.executionCount)} runtime
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock3 className="size-3" />
          {relativeTime(project.updatedAt)}
        </span>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button size="sm" asChild>
          <Link to="/projects/$id" params={{ id: project.id }}>
            Open
          </Link>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link to="/projects/$id/edit" params={{ id: project.id }}>
            <Code2 className="size-3.5" />
            Edit
          </Link>
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <Link to="/projects/$id/analytics" params={{ id: project.id }}>
            <Activity className="size-3.5" />
            Analytics
          </Link>
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <Link to="/projects/$id/settings" params={{ id: project.id }}>
            <Settings2 className="size-3.5" />
            Settings
          </Link>
        </Button>
      </div>
    </article>
  );
}
