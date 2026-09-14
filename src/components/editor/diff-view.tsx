import { diffLines } from "@/lib/luau/highlight";
import { cn } from "@/lib/utils";

export function DiffView({
  left,
  right,
  leftLabel,
  rightLabel,
}: {
  left: string;
  right: string;
  leftLabel: string;
  rightLabel: string;
}) {
  const lines = diffLines(left, right);
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] bg-bg shadow-[var(--shadow-border)]">
      <div className="flex items-center justify-between border-b border-border px-4 py-2 font-mono text-[11px] text-muted">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
      <div className="max-h-[28rem] overflow-auto font-mono text-[12px] leading-6">
        {lines.map((line, i) => (
          <div
            key={i}
            className={cn(
              "grid grid-cols-[3rem_1fr] px-3",
              line.type === "add" && "bg-success/10 text-success",
              line.type === "del" && "bg-danger/10 text-danger",
              line.type === "same" && "text-muted",
            )}
          >
            <span className="pr-3 text-right text-subtle tabular-nums">
              {line.left ?? line.right ?? ""}
            </span>
            <span className="whitespace-pre">
              {line.type === "add" ? "+ " : line.type === "del" ? "- " : "  "}
              {line.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
