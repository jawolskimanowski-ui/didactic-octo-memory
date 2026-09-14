import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/brand/logo";

const COPY: Record<
  number,
  { title: string; body: string }
> = {
  401: {
    title: "Authentication required",
    body: "Sign in to manage private Luau projects. Source is never shown to guests.",
  },
  403: {
    title: "Access denied",
    body: "Only the project owner can open private source, versions, or settings.",
  },
  404: {
    title: "Project not found",
    body: "This project does not exist, is unpublished, or is not available to you.",
  },
  429: {
    title: "Too many requests",
    body: "The raw endpoint is rate-limited. Wait a moment and retry the HttpGet.",
  },
  500: {
    title: "Server error",
    body: "Something went wrong on our side. No source, secrets, or stack traces are exposed here.",
  },
};

export function ErrorPage({
  code,
  title,
  body,
}: {
  code: number;
  title?: string;
  body?: string;
}) {
  const preset = COPY[code] ?? COPY[500]!;
  return (
    <main className="relative flex min-h-dvh flex-col bg-bg text-fg">
      <div className="grid-noise pointer-events-none absolute inset-0 opacity-60" />
      <header className="relative z-10 flex items-center justify-between px-5 py-5 md:px-8">
        <Wordmark />
      </header>
      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 pb-24">
        <p className="font-mono text-sm tracking-[0.2em] text-subtle">{code}</p>
        <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight">
          {title ?? preset.title}
        </h1>
        <p className="mt-3 text-muted">{body ?? preset.body}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/">Home</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/docs">Documentation</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
