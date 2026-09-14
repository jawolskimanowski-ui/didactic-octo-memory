import { createFileRoute } from "@tanstack/react-router";
import { ProjectChrome } from "@/components/projects/project-chrome";

export const Route = createFileRoute("/_app/projects/$id")({
  component: ProjectChrome,
});
