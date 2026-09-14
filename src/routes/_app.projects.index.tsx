import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { listProjects } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "@/components/projects/project-card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_app/projects/")({
  component: ProjectsPage,
});

function ProjectsPage() {
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => listProjects() });
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] tracking-wide text-subtle uppercase">
            Projects
          </p>
          <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">
            Your Luau projects
          </h1>
        </div>
        <Button asChild>
          <Link to="/projects/new">
            <Plus className="size-4" />
            New project
          </Link>
        </Button>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {projects.isLoading
          ? Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-48 rounded-[var(--radius-xl)]" />
            ))
          : (projects.data ?? []).map((p) => <ProjectCard key={p.id} project={p} />)}
      </div>
      {!projects.isLoading && (projects.data?.length ?? 0) === 0 ? (
        <p className="mt-8 text-sm text-muted">No projects yet. Create one to host a private script.</p>
      ) : null}
    </div>
  );
}
