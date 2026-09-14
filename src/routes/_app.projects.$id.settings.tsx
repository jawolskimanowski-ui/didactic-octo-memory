import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  archiveProjectFn,
  deleteProjectFn,
  getProject,
  updateProject,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/projects/$id/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const project = useQuery({
    queryKey: ["project", id],
    queryFn: () => getProject({ data: { id } }),
  });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [obfuscate, setObfuscate] = useState(false);

  useEffect(() => {
    if (!project.data) return;
    setName(project.data.name);
    setDescription(project.data.description);
    setSlug(project.data.slug);
    setObfuscate(Boolean(project.data.obfuscate));
  }, [project.data]);

  if (!project.data) return null;

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8 md:px-8">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await updateProject({ data: { id, name, description, slug, obfuscate } });
            toast.success("Saved");
            await qc.invalidateQueries({ queryKey: ["project", id] });
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Save failed");
          }
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="slug">Raw slug</Label>
          <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
          <p className="text-xs text-subtle">
            Changing the slug changes /raw/{"<slug>"} for every published version.
          </p>
        </div>
        <div className="flex items-center justify-between rounded-[var(--radius-md)] bg-bg-elevated p-4 shadow-[var(--shadow-border)]">
          <div className="pr-4">
            <Label htmlFor="obfuscate">Protect published payload</Label>
            <p className="mt-1 text-xs text-muted">Uses the existing server-side Luau obfuscation layer. It raises reverse-engineering cost but cannot make client-delivered Luau impossible to inspect.</p>
          </div>
          <Switch id="obfuscate" checked={obfuscate} onCheckedChange={setObfuscate} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="desc">Description</Label>
          <Textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <p className="font-mono text-xs text-subtle">ID {project.data.id}</p>
        <Button type="submit">Save settings</Button>
      </form>

      <div className="mt-12 space-y-3 border-t border-border pt-8">
        <h2 className="font-display text-lg font-semibold">Danger</h2>
        <p className="text-sm text-muted">
          Archiving hides the project from the dashboard. Deleting removes source,
          versions, analytics, and webhooks for this project.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              await archiveProjectFn({ data: { id } });
              toast.success("Archived");
              await navigate({ to: "/projects" });
            }}
          >
            Archive
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="danger">Delete project</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {project.data.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes private source and cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    await deleteProjectFn({ data: { id } });
                    toast.success("Deleted");
                    await navigate({ to: "/projects" });
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
