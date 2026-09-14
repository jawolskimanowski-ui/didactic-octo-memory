import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { createProject, listTemplates } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_app/projects/new")({
  component: NewProjectPage,
});

function NewProjectPage() {
  const navigate = useNavigate();
  const templates = useQuery({
    queryKey: ["templates"],
    queryFn: () => listTemplates(),
  });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [templateId, setTemplateId] = useState("welcome");
  const [pending, setPending] = useState(false);
  const [obfuscate, setObfuscate] = useState(false);

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8 md:px-8">
      <p className="font-mono text-[11px] tracking-wide text-subtle uppercase">
        New project
      </p>
      <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">
        Host a Luau script
      </h1>
      <p className="mt-2 text-sm text-muted">
        Source is private from the first save. Publishing later creates a raw
        endpoint — not a public source page.
      </p>
      <form
        className="mt-8 flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setPending(true);
          try {
            const project = await createProject({
              data: { name, description, templateId, obfuscate },
            });
            toast.success("Project created");
            await navigate({ to: "/projects/$id/edit", params: { id: project.id } });
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not create project");
            setPending(false);
          }
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="MyScript"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="desc">Description</Label>
          <Textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this script does in the experience"
          />
        </div>
        <div className="flex items-center justify-between rounded-[var(--radius-md)] bg-bg-elevated p-4 shadow-[var(--shadow-border)]">
          <div className="pr-4">
            <Label htmlFor="obfuscate">Protect published payload</Label>
            <p className="mt-1 text-xs text-muted">Apply the server-side Luau obfuscation layer before the runtime wrapper is generated. This is protection, not an unrecoverable guarantee.</p>
          </div>
          <Switch id="obfuscate" checked={obfuscate} onCheckedChange={setObfuscate} />
        </div>
        <div>
          <Label>Starter template</Label>
          <div className="mt-2 grid gap-2">
            {(templates.data ?? []).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplateId(t.id)}
                className={cn(
                  "rounded-[var(--radius-md)] bg-bg-elevated p-4 text-left shadow-[var(--shadow-border)]",
                  templateId === t.id && "shadow-[0_0_0_1px_var(--color-accent)]",
                )}
              >
                <p className="text-sm font-medium">{t.name}</p>
                <p className="mt-1 text-sm text-muted">{t.description}</p>
              </button>
            ))}
          </div>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create private project"}
        </Button>
      </form>
    </div>
  );
}
