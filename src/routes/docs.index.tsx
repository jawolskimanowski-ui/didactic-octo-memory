import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/layout/site-header";
import { DocsNav } from "@/components/docs/nav";
import { DOC_SECTIONS } from "@/lib/docs/content";

export const Route = createFileRoute("/docs/")({ component: DocsIndex });

function DocsIndex() {
  return (
    <main className="min-h-dvh bg-bg text-fg">
      <SiteHeader />
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-10 md:grid-cols-[14rem_1fr] md:px-8">
        <DocsNav />
        <div>
          <p className="font-mono text-[11px] tracking-[0.2em] text-subtle uppercase">
            Documentation
          </p>
          <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight">
            Roblox Luau, hosted privately.
          </h1>
          <p className="mt-4 max-w-2xl text-muted">
            This is not a general-purpose coding handbook. Every page is about
            loadstring, protected payloads, runtime executions, and keeping plaintext off the public web.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {DOC_SECTIONS.map((s) => (
              <Link
                key={s.slug}
                to="/docs/$slug"
                params={{ slug: s.slug }}
                className="rounded-[var(--radius-lg)] bg-bg-elevated p-5 shadow-[var(--shadow-border)] transition-[box-shadow] duration-150 hover:shadow-[var(--shadow-border-hover)]"
              >
                <h2 className="font-display text-lg font-semibold">{s.title}</h2>
                <p className="mt-2 text-sm text-muted">{s.summary}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

