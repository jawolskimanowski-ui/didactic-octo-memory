import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  archiveVersionFn,
  compareVersionsFn,
  listVersions,
  publishVersionFn,
  rollbackVersionFn,
} from "@/lib/api";
import { DiffView } from "@/components/editor/diff-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/utils";
import type { VersionSource } from "@/lib/types";

export const Route = createFileRoute("/_app/projects/$id/versions")({
  component: VersionsPage,
});

function VersionsPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const versions = useQuery({
    queryKey: ["versions", id],
    queryFn: () => listVersions({ data: { projectId: id } }),
  });
  const [left, setLeft] = useState<string | null>(null);
  const [right, setRight] = useState<string | null>(null);
  const [diff, setDiff] = useState<{ left: VersionSource; right: VersionSource } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await qc.invalidateQueries();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <p className="text-sm text-muted">
        Version history is private. Opening source for a compare is audited.
      </p>
      <div className="mt-6 overflow-hidden rounded-[var(--radius-xl)] bg-bg-elevated shadow-[var(--shadow-border)]">
        <table className="w-full text-left text-sm">
          <thead className="font-mono text-[11px] tracking-wide text-subtle uppercase">
            <tr className="border-b border-border">
              <th className="px-4 py-3">Version</th>
              <th className="hidden px-4 py-3 sm:table-cell">Notes</th>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {(versions.data ?? []).map((v) => (
              <tr key={v.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono">v{v.version}</span>
                    {v.isPublished ? <Badge variant="published">Live</Badge> : null}
                  </div>
                </td>
                <td className="hidden px-4 py-3 text-muted sm:table-cell">
                  {v.changelog || "—"}
                </td>
                <td className="px-4 py-3 text-muted">{relativeTime(v.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy || v.isPublished}
                      onClick={() =>
                        run(
                          () =>
                            publishVersionFn({
                              data: { projectId: id, versionId: v.id },
                            }),
                          `Published v${v.version}`,
                        )
                      }
                    >
                      Publish
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () =>
                            rollbackVersionFn({
                              data: { projectId: id, versionId: v.id },
                            }),
                          `Rolled back to v${v.version}`,
                        )
                      }
                    >
                      Roll back
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy || v.isPublished}
                      onClick={() =>
                        run(
                          () =>
                            archiveVersionFn({
                              data: { projectId: id, versionId: v.id },
                            }),
                          "Archived",
                        )
                      }
                    >
                      Archive
                    </Button>
                    <Button
                      size="sm"
                      variant={left === v.id ? "secondary" : "ghost"}
                      onClick={() => setLeft(v.id)}
                    >
                      Left
                    </Button>
                    <Button
                      size="sm"
                      variant={right === v.id ? "secondary" : "ghost"}
                      onClick={() => setRight(v.id)}
                    >
                      Right
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4">
        <Button
          variant="outline"
          disabled={!left || !right || left === right}
          onClick={async () => {
            if (!left || !right) return;
            try {
              const result = await compareVersionsFn({
                data: { projectId: id, leftId: left, rightId: right },
              });
              setDiff(result);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Compare failed");
            }
          }}
        >
          Compare selected
        </Button>
      </div>
      {diff ? (
        <div className="mt-6">
          <DiffView
            left={diff.left.sourceCode}
            right={diff.right.sourceCode}
            leftLabel={`v${diff.left.version}`}
            rightLabel={`v${diff.right.version}`}
          />
        </div>
      ) : null}
    </div>
  );
}
