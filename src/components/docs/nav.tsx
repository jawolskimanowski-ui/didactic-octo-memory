import { Link } from "@tanstack/react-router";
import { DOC_SECTIONS } from "@/lib/docs/content";

export function DocsNav() {
  return (
    <nav className="hidden md:block">
      <p className="mb-3 font-mono text-[11px] tracking-wide text-subtle uppercase">
        Guides
      </p>
      <ul className="space-y-1">
        <li>
          <Link
            to="/docs"
            className="block rounded-[var(--radius-sm)] px-3 py-2 text-sm text-muted hover:bg-bg-subtle hover:text-fg"
          >
            Overview
          </Link>
        </li>
        {DOC_SECTIONS.map((s) => (
          <li key={s.slug}>
            <Link
              to="/docs/$slug"
              params={{ slug: s.slug }}
              className="block rounded-[var(--radius-sm)] px-3 py-2 text-sm text-muted hover:bg-bg-subtle hover:text-fg"
            >
              {s.title}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
