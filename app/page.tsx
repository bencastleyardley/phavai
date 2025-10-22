// Home (server component). Uses plain <a> for all links to avoid typedRoutes issues.

export default function Page() {
  const updated = new Date().toLocaleDateString();

  const internalPages = [
    { href: "/best-mens-trail-running-shoes", label: "Best Men’s Trail Running Shoes" },
    { href: "/best-womens-trail-running-shoes", label: "Best Women’s Trail Running Shoes" },
    { href: "/methodology", label: "Methodology" }
  ] as const;

  const externalResources = [
    { url: "https://believeintherun.com/", label: "Believe in the Run (review source)" },
    { url: "https://www.irunfar.com/", label: "iRunFar (review source)" },
    { url: "https://runrepeat.com/", label: "RunRepeat (lab/aggregator)" }
  ] as const;

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      {/* Hero */}
      <section className="rounded-2xl border p-8 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight">Phavai — Honest, Static Best Picks</h1>
        <p className="mt-3 text-muted-foreground">
          We average sentiment from <span className="font-medium">Published</span>,{" "}
          <span className="font-medium">Reddit</span>, <span className="font-medium">YouTube</span>, and{" "}
          <span className="font-medium">Social</span> into one clear score. Reviewer tiers (🥇/🥈/🥉) make our
          sources transparent at a glance.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">Last updated: {updated}</p>

        {/* Primary CTAs (internal) */}
        <div className="mt-6 flex flex-wrap gap-3">
          {internalPages.map((it) => (
            <a
              key={it.href}
              href={it.href}
              className="inline-flex items-center rounded-lg border px-4 py-2 font-medium hover:bg-accent"
            >
              {it.label}
            </a>
          ))}
        </div>
      </section>

      {/* Why trust us */}
      <section className="mt-10 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border p-4">
          <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Transparent</div>
          <h2 className="mt-1 text-lg font-semibold">Reviewer Tiers</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every link shows a tier badge with a tooltip explaining why that source is trusted.
          </p>
        </div>
        <div className="rounded-xl border p-4">
          <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Static-First</div>
          <h2 className="mt-1 text-lg font-semibold">Fast & SEO-Friendly</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Fully prerendered pages from JSON—fast loads, no flicker, and clean schema for search.
          </p>
        </div>
        <div className="rounded-xl border p-4">
          <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Simple Math</div>
          <h2 className="mt-1 text-lg font-semibold">4-Bucket Average</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Equal-weight average of Published, Reddit, YouTube, and Social. No pay-to-play.
          </p>
        </div>
      </section>

      {/* Example external resources */}
      <section className="mt-10">
        <h3 className="text-lg font-semibold">Some Sources We Track</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {externalResources.map((it) => (
            <a
              key={it.url}
              href={it.url}
              target="_blank"
              rel="nofollow noopener"
              className="text-sm rounded-lg px-3 py-2 border hover:bg-accent"
              aria-label={`Open ${it.label} in a new tab`}
            >
              {it.label}
            </a>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-12 text-sm text-muted-foreground">
        © {new Date().getFullYear()} Phavai. Affiliate links may earn us a commission.{" "}
        <a href="/methodology" className="underline hover:no-underline">
          Learn how we score and choose sources
        </a>
        .
      </footer>
    </main>
  );
}
