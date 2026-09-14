import { createFileRoute, notFound } from "@tanstack/react-router";
import { SiteHeader } from "@/components/layout/site-header";
import { CodeBlock } from "@/components/code-block";
import { DocsNav } from "@/components/docs/nav";
import { DOC_SECTIONS, getDoc } from "@/lib/docs/content";

export const Route = createFileRoute("/docs/$slug")({
  loader: ({ params }) => {
    const doc = getDoc(params.slug);
    if (!doc) throw notFound();
    return doc;
  },
  component: DocPage,
});

function DocPage() {
  const doc = Route.useLoaderData();
  return (
    <main className="min-h-dvh bg-bg text-fg">
      <SiteHeader />
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-10 md:grid-cols-[14rem_1fr] md:px-8">
        <DocsNav />
        <article className="max-w-2xl pb-16">
          <p className="font-mono text-[11px] tracking-[0.2em] text-subtle uppercase">
            {DOC_SECTIONS.findIndex((s) => s.slug === doc.slug) + 1} / {DOC_SECTIONS.length}
          </p>
          <h1 className="font-display mt-3 text-4xl font-semibold tracking-tight">
            {doc.title}
          </h1>
          <p className="mt-3 text-muted">{doc.summary}</p>
          <div className="mt-10 space-y-10">
            {doc.body.map((block) => (
              <section key={block.heading ?? block.paragraphs[0]}>
                {block.heading ? (
                  <h2 className="font-display text-xl font-semibold">{block.heading}</h2>
                ) : null}
                {block.paragraphs.map((p) => (
                  <p key={p} className="mt-3 text-[15px] leading-relaxed text-muted">
                    {p}
                  </p>
                ))}
                {block.code ? <CodeBlock className="mt-4" code={block.code} /> : null}
              </section>
            ))}
          </div>
        </article>
      </div>
    </main>
  );
}
