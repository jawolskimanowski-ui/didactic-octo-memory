import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  getCurrentSource,
  getProject,
  publishVersionFn,
  saveVersion,
} from "@/lib/api";
import { LuauEditor } from "@/components/editor/luau-editor";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorPage } from "@/components/errors/error-page";
import { Lock } from "lucide-react";

export const Route = createFileRoute("/_app/projects/$id/edit")({
  component: EditorPage,
});

function EditorPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const project = useQuery({
    queryKey: ["project", id],
    queryFn: () => getProject({ data: { id } }),
  });
  const sourceQuery = useQuery({
    queryKey: ["source", id],
    queryFn: () => getCurrentSource({ data: { projectId: id } }),
  });
  const [draft, setDraft] = useState<string | null>(null);
  const [changelog, setChangelog] = useState("");
  const [bump, setBump] = useState<"patch" | "minor" | "major">("patch");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (sourceQuery.data && draft === null) setDraft(sourceQuery.data.sourceCode);
  }, [sourceQuery.data, draft]);

  useEffect(() => {
    const dirty = draft !== null && draft !== sourceQuery.data?.sourceCode;
    const onBefore = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, [draft, sourceQuery.data?.sourceCode]);

  if (sourceQuery.error) {
    const message = sourceQuery.error instanceof Error ? sourceQuery.error.message : "";
    if (message === "Unauthorized") return <ErrorPage code={401} />;
    if (message === "Access denied") return <ErrorPage code={403} />;
    return <ErrorPage code={404} />;
  }

  const dirty = draft !== null && draft !== sourceQuery.data?.sourceCode;
  const versionLabel = sourceQuery.data?.version ?? project.data?.currentVersion;

  const save = async (andPublish: boolean) => {
    if (draft === null) return;
    setSaving(true);
    try {
      const saved = await saveVersion({
        data: { projectId: id, source: draft, changelog, bump },
      });
      if (andPublish) {
        await publishVersionFn({
          data: { projectId: id, versionId: saved.id },
        });
        toast.success(`Published v${saved.version}`);
      } else {
        toast.success(`Saved v${saved.version}`);
      }
      setChangelog("");
      await qc.invalidateQueries();
      setDraft(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] min-h-[28rem] flex-col px-3 py-4 md:px-6">
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] bg-bg-elevated px-3 py-2 shadow-[var(--shadow-border)]">
        <Lock className="size-3.5 text-muted" />
        <p className="text-sm">
          <span className="font-medium">Private source.</span>{" "}
          <span className="text-muted">
            Only you can read this. Publishing wraps it; executions count when the
            script runs, not when /raw is fetched.
          </span>
        </p>
        {dirty ? (
          <span className="ml-auto font-mono text-[11px] text-warning">Unsaved</span>
        ) : (
          <span className="ml-auto font-mono text-[11px] text-subtle">
            v{versionLabel ?? "—"}
          </span>
        )}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          value={changelog}
          onChange={(e) => setChangelog(e.target.value)}
          placeholder="Changelog"
          className="h-9 max-w-xs"
        />
        <Select value={bump} onValueChange={(v) => setBump(v as typeof bump)}>
          <SelectTrigger className="h-9 w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="patch">Patch</SelectItem>
            <SelectItem value="minor">Minor</SelectItem>
            <SelectItem value="major">Major</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" disabled={saving || draft === null} onClick={() => save(false)}>
          Save
        </Button>
        <Button size="sm" disabled={saving || draft === null} onClick={() => save(true)}>
          Save & publish
        </Button>
      </div>
      {draft === null ? (
        <Skeleton className="min-h-0 flex-1 rounded-[var(--radius-lg)]" />
      ) : (
        <LuauEditor value={draft} onChange={setDraft} onSave={() => save(false)} />
      )}
    </div>
  );
}
