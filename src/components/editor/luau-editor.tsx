import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Search, X } from "lucide-react";
import { highlightLuau } from "@/lib/luau/highlight";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (next: string) => void;
  onSave?: () => void;
};

export function LuauEditor({ value, onChange, onSave }: Props) {
  const preRef = useRef<HTMLPreElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [replace, setReplace] = useState("");
  const [match, setMatch] = useState(0);

  const html = useMemo(() => highlightLuau(value) + "\n", [value]);
  const lines = useMemo(() => value.split("\n").length, [value]);

  const syncScroll = () => {
    const ta = taRef.current;
    if (!ta) return;
    if (preRef.current) {
      preRef.current.scrollTop = ta.scrollTop;
      preRef.current.scrollLeft = ta.scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      onSave?.();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
      e.preventDefault();
      setFindOpen(true);
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const next = `${value.slice(0, start)}\t${value.slice(end)}`;
      onChange(next);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 1;
      });
    }
  };

  const matches = useMemo(() => {
    if (!query) return [] as number[];
    const found: number[] = [];
    const q = query.toLowerCase();
    const hay = value.toLowerCase();
    let from = 0;
    while (from < hay.length) {
      const idx = hay.indexOf(q, from);
      if (idx === -1) break;
      found.push(idx);
      from = idx + Math.max(1, q.length);
    }
    return found;
  }, [query, value]);

  useEffect(() => {
    if (match >= matches.length) setMatch(0);
  }, [match, matches.length]);

  const jump = useCallback(
    (dir: 1 | -1) => {
      if (!matches.length) return;
      const next = (match + dir + matches.length) % matches.length;
      setMatch(next);
      const ta = taRef.current;
      if (!ta) return;
      const start = matches[next]!;
      ta.focus();
      ta.setSelectionRange(start, start + query.length);
    },
    [match, matches, query.length],
  );

  const replaceOne = () => {
    if (!matches.length) return;
    const start = matches[match] ?? 0;
    const next = `${value.slice(0, start)}${replace}${value.slice(start + query.length)}`;
    onChange(next);
  };

  const replaceAll = () => {
    if (!query) return;
    onChange(value.split(query).join(replace));
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-lg)] bg-bg shadow-[var(--shadow-border)]">
      {findOpen ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
          <Search className="size-3.5 text-subtle" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find"
            className="h-9 w-36"
            onKeyDown={(e) => {
              if (e.key === "Enter") jump(e.shiftKey ? -1 : 1);
              if (e.key === "Escape") setFindOpen(false);
            }}
          />
          <Input
            value={replace}
            onChange={(e) => setReplace(e.target.value)}
            placeholder="Replace"
            className="h-9 w-36"
          />
          <span className="font-mono text-[11px] text-subtle tabular-nums">
            {matches.length ? `${match + 1}/${matches.length}` : "0"}
          </span>
          <Button size="sm" variant="ghost" onClick={() => jump(-1)}>
            Prev
          </Button>
          <Button size="sm" variant="ghost" onClick={() => jump(1)}>
            Next
          </Button>
          <Button size="sm" variant="outline" onClick={replaceOne}>
            Replace
          </Button>
          <Button size="sm" variant="outline" onClick={replaceAll}>
            All
          </Button>
          <button
            type="button"
            className="ml-auto inline-flex size-9 items-center justify-center text-muted hover:text-fg"
            onClick={() => setFindOpen(false)}
            aria-label="Close search"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div
          ref={gutterRef}
          className="overflow-hidden bg-bg py-4 pr-2 pl-3 text-right font-mono text-xs leading-6 text-subtle select-none"
          aria-hidden
        >
          {Array.from({ length: lines }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <div className="relative min-h-0 min-w-0 flex-1">
          <pre
            ref={preRef}
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 overflow-auto p-4 font-mono text-[13px] leading-6 whitespace-pre",
              "text-fg",
            )}
            dangerouslySetInnerHTML={{ __html: html }}
          />
          <textarea
            ref={taRef}
            value={value}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            onScroll={syncScroll}
            onKeyDown={onKeyDown}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 size-full resize-none bg-transparent p-4 font-mono text-[13px] leading-6 text-transparent caret-accent outline-none"
            aria-label="Private Luau source"
          />
        </div>
      </div>
    </div>
  );
}
