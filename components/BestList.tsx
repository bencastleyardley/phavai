"use client";

import React from "react";
import Tooltip from "@/components/Tooltip";

export type LinkItem = { label: string; url: string };
export type Product = {
  brand: string;
  model: string;
  price: number;
  badges: string[];
  published: number;
  reddit: number;
  youtube: number;
  social: number;
  last_sampled: string;
  affiliate: { retailer: string; url: string };
  links: { published: LinkItem[]; reddit: LinkItem[]; youtube: LinkItem[]; social: LinkItem[] };
};

export function bestPickScore(p: Product) {
  const avg = (p.published + p.reddit + p.youtube + p.social) / 4;
  return Math.round(avg * 100) / 100;
}

function weather(score: number) {
  if (score >= 4.5) return "☀️";
  if (score >= 4.2) return "🌤️";
  if (score >= 3.8) return "☁️";
  return "🌧️";
}

function domain(u: string) {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function Row({ title, links, getTier }: { title: string; links: LinkItem[]; getTier: (d: string) => { badge?: string; tip?: string } }) {
  const [open, setOpen] = React.useState(true);
  return (
    <div className="rounded-lg border">
      <button className="flex w-full items-center justify-between px-3 py-2 text-left" onClick={() => setOpen(!open)}>
        <span className="text-xs font-semibold uppercase tracking-wide">{title}</span>
        <span className="text-xl">{open ? "–" : "+"}</span>
      </button>
      {open && (
        <div className="grid gap-2 border-t p-3 md:grid-cols-3">
          {links.map((l, i) => {
            const d = domain(l.url);
            const { badge, tip } = getTier(d);
            const pill = (
              <a key={i} href={l.url} target="_blank" rel="nofollow noopener"
                 className="flex items-center justify-between gap-2 rounded-lg border px-2 py-2 text-xs hover:bg-accent">
                <span className="truncate">{l.label}</span>
                <span className="shrink-0 text-muted-foreground">{d}</span>
              </a>
            );
            return badge ? (
              <Tooltip key={i} text={tip ?? ""}>
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-base">{badge}</span>{pill}
                </div>
              </Tooltip>
            ) : pill;
          })}
        </div>
      )}
    </div>
  );
}

export default function BestList({ items, vertical }: { items: Product[]; vertical: string }) {
  const sorted = React.useMemo(
    () => items.map((p) => ({ ...p, bestPick: bestPickScore(p) })).sort((a, b) => b.bestPick - a.bestPick || a.price - b.price),
    [items]
  );

  // lazy import to avoid bundling fs on client
  const getTier = React.useCallback((d: string) => {
    // Render-only hint: server injects a window.__TIERS__ map via <script> on the page
    const tiers: Record<string, { badge: string; tip: string }> = (globalThis as any).__TIERS__ || {};
    return tiers[d] || {};
  }, []);

  return (
    <section className="grid gap-4">
      {sorted.map((p, idx) => (
        <article key={`${p.brand}-${p.model}`} className="rounded-2xl border p-4 shadow-sm transition hover:shadow-md">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1.5">
              <h2 className="text-xl font-semibold">{idx + 1}. {p.brand} {p.model}</h2>
              <div className="flex flex-wrap items-center gap-2">
                {p.badges.map((b) => <span key={b} className="rounded-full border px-2 py-0.5 text-xs font-medium">{b}</span>)}
              </div>
              <div className="text-sm text-muted-foreground">MSRP: ${p.price} • Sampled: {p.last_sampled}</div>
            </div>
            <div className="shrink-0 rounded-xl border px-3 py-2 text-center">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">BestPick</div>
              <div className="text-3xl font-bold leading-none">
                {p.bestPick.toFixed(2)} <span className="text-2xl">{weather(p.bestPick)}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Avg of 4 sources</div>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <Row title="Published" links={p.links.published} getTier={getTier} />
            <Row title="Reddit" links={p.links.reddit} getTier={getTier} />
            <Row title="YouTube" links={p.links.youtube} getTier={getTier} />
            <Row title="Social / Reporting" links={p.links.social} getTier={getTier} />
          </div>

          <div className="mt-4">
            <a href={p.affiliate.url} target="_blank" rel="nofollow noopener"
               className="inline-flex items-center justify-center rounded-xl border px-4 py-2 font-medium hover:bg-accent">
              View at {p.affiliate.retailer}
            </a>
          </div>
        </article>
      ))}
    </section>
  );
}
