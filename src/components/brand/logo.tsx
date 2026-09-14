import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Wordmark({
  className,
  to = "/",
}: {
  className?: string;
  to?: "/";
}) {
  return (
    <Link to={to} className={cn("flex items-center gap-2.5", className)}>
      <span
        aria-hidden
        className="grid size-8 place-items-center rounded-[var(--radius-sm)] bg-bg-subtle shadow-[var(--shadow-border)]"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M4 3.5h5.2c1.7 0 2.8 1.05 2.8 2.55 0 1.5-1.1 2.55-2.8 2.55H6.2V12.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="font-display text-[15px] font-semibold tracking-tight">
        loadstring
        <span className="text-muted">.lua</span>
      </span>
    </Link>
  );
}
