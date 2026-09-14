import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { highlightLuau } from "@/lib/luau/highlight";
import { cn } from "@/lib/utils";

export function CodeBlock({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-lg)] bg-bg-subtle shadow-[var(--shadow-border)]",
        className,
      )}
    >
      <button
        type="button"
        className="absolute top-3 right-3 inline-flex size-9 items-center justify-center rounded-[var(--radius-sm)] text-muted hover:bg-bg-elevated hover:text-fg"
        onClick={async () => {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1400);
        }}
        aria-label="Copy"
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </button>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-fg">
        <code dangerouslySetInnerHTML={{ __html: highlightLuau(code) }} />
      </pre>
    </div>
  );
}
