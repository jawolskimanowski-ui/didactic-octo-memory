import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  GitBranch,
  Lock,
  ShieldCheck,
  Webhook,
} from "lucide-react";
import { useCurrentSiteUser } from "@/lib/site-session";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/code-block";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({ component: Home });

const SNIPPET = `loadstring(game:HttpGet("https://loadstring.lua/raw/my-script"))()`;

function HomeActions() {
  const user = useCurrentSiteUser();
  return (
    <div className="mt-8 flex flex-wrap gap-3">
      <Button size="lg" asChild>
        <Link to={user ? "/projects/new" : "/signup"}>
          {user ? "Create project" : "Register & create project"}
          <ArrowRight className="size-4" />
        </Link>
      </Button>
      <Button size="lg" variant="outline" asChild>
        <Link to="/docs">Documentation</Link>
      </Button>
    </div>
  );
}

function Home() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-bg text-fg">
      <div className="grid-noise pointer-events-none absolute inset-0" />
      <SiteHeader />
      <section className="relative mx-auto w-full max-w-6xl px-5 pt-10 pb-20 md:px-8 md:pt-16">
        <div className="stagger-in max-w-3xl">
          <p className="font-mono text-[11px] tracking-[0.22em] text-subtle uppercase">
            Roblox Luau · private hosting
          </p>
          <h1 className="font-display mt-4 text-[clamp(2.6rem,7vw,5.4rem)] leading-[0.95] font-semibold tracking-tight">
            Build.
            <br />
            Publish.
            <br />
            Track.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted">
            Host loadstring endpoints without putting editor source on a public
            page. Executions are counted when the script actually runs — on any
            player, any account.
          </p>
          <HomeActions />
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[var(--radius-xl)] bg-bg-elevated p-2 shadow-[var(--shadow-border)]">
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="size-2 rounded-full bg-fg/20" />
              <span className="size-2 rounded-full bg-fg/20" />
              <span className="size-2 rounded-full bg-fg/20" />
              <span className="ml-2 font-mono text-[11px] text-subtle">
                LocalScript
              </span>
            </div>
            <CodeBlock code={SNIPPET} className="rounded-[calc(var(--radius-xl)-8px)] shadow-none" />
          </div>
          <aside className="flex flex-col justify-between rounded-[var(--radius-xl)] bg-bg-elevated p-6 shadow-[var(--shadow-border)]">
            <div>
              <p className="text-sm text-muted">MyScript</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="published">Published</Badge>
                <span className="font-mono text-sm text-muted">v1.0.0</span>
              </div>
              <p className="mt-6 font-mono text-[11px] tracking-wide text-subtle uppercase">
                Runtime executions
              </p>
              <p className="font-display mt-1 text-4xl font-semibold tabular-nums">
                0
              </p>
              <p className="mt-2 font-mono text-xs text-muted">
                Counted when the beacon runs, not on fetch
              </p>
            </div>
            <p className="mt-8 text-sm text-muted">
              /raw serves a protected payload. The website never shows plaintext
              to anyone but you.
            </p>
          </aside>
        </div>
      </section>

      <section className="relative mx-auto grid w-full max-w-6xl gap-4 px-5 pb-20 md:grid-cols-2 md:px-8 lg:grid-cols-4">
        {[
          {
            icon: Lock,
            title: "Private source",
            body: "Ownership checks on every source read. No public viewer, no source in page props.",
          },
          {
            icon: GitBranch,
            title: "Versions",
            body: "Save, publish, compare, and roll back. The slug stays stable.",
          },
          {
            icon: Activity,
            title: "Runtime analytics",
            body: "Executions increment when the injected beacon fires inside a player — not when /raw is merely fetched.",
          },
          {
            icon: Webhook,
            title: "Webhook proxy",
            body: "Secrets stay encrypted on the server. Luau never holds the signing key.",
          },
        ].map((f) => (
          <article
            key={f.title}
            className="rounded-[var(--radius-lg)] bg-bg-elevated p-5 shadow-[var(--shadow-border)]"
          >
            <f.icon className="size-4 text-muted" />
            <h2 className="font-display mt-4 text-base font-semibold">{f.title}</h2>
            <p className="mt-2 text-sm text-muted">{f.body}</p>
          </article>
        ))}
      </section>

      <section className="relative mx-auto grid w-full max-w-6xl gap-6 px-5 pb-24 md:grid-cols-2 md:px-8">
        <article className="rounded-[var(--radius-xl)] bg-bg-elevated p-6 shadow-[var(--shadow-border)]">
          <p className="font-mono text-[11px] tracking-wide text-subtle uppercase">
            Versioning
          </p>
          <h2 className="font-display mt-2 text-2xl font-semibold">Ship 1.4.2. Keep 1.3.0.</h2>
          <ol className="mt-6 space-y-3 font-mono text-sm">
            {[
              ["1.4.2", "Published · 2h ago"],
              ["1.4.1", "Draft"],
              ["1.3.0", "Previous"],
              ["1.0.0", "First publish"],
            ].map(([v, s]) => (
              <li key={v} className="flex items-center justify-between rounded-[var(--radius-sm)] bg-bg-subtle px-3 py-2">
                <span>v{v}</span>
                <span className="text-subtle">{s}</span>
              </li>
            ))}
          </ol>
        </article>
        <article className="rounded-[var(--radius-xl)] bg-bg-elevated p-6 shadow-[var(--shadow-border)]">
          <p className="font-mono text-[11px] tracking-wide text-subtle uppercase">
            Protection
          </p>
          <h2 className="font-display mt-2 text-2xl font-semibold">Protected payload. Honest edge.</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Published /raw is a UUID-keyed loader, not editor plaintext. The
            unwrap key is released only when the script launches. There is no
            account lock — any player can execute it. We still do not claim
            unwrapped Luau is mathematically unrecoverable.
          </p>
          <div className="mt-6 flex items-start gap-3 rounded-[var(--radius-md)] bg-bg-subtle p-4">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted" />
            <p className="text-sm text-muted">
              Authenticated owner → owns project → source. Anyone else gets 401
              or 403, never the file.
            </p>
          </div>
        </article>
      </section>

      <footer className="relative border-t border-border px-5 py-8 md:px-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-xs text-subtle">loadstring.lua</p>
          <p className="font-mono text-xs text-subtle">
            Scripting made possible with grok 4.6
          </p>
          <div className="flex gap-4 text-sm text-muted">
            <Link to="/docs" className="hover:text-fg">
              Docs
            </Link>
            <Link to="/docs/$slug" params={{ slug: "security" }} className="hover:text-fg">
              Security
            </Link>
            <Link to="/login" className="hover:text-fg">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
