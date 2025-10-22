"use client";
import React from "react";
import ScoreChip from "@/components/ScoreChip";

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

function avg(p: Product) {
  return (p.published + p.reddit + p.youtube + p.social) / 4;
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
function toneFor(v: number): "good"|"ok"|"poor"|"default" {
  if (v >= 4.4) return "good";
  if (v >= 3.9) return "ok";
  if (v < 3.6) return "poor";
  return "default";
}

function Bucket({
  title, score, links,
}: { title: string; score: number; links: LinkItem[] }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide">{title}</span>
          <ScoreChip label="score" value={score} tone={toneFor(score)} />
        </div>
        <span className="text-xl">{open ? "–" : "+"}</span>
      </button>
      {open && (
        <div className="grid gap-2 border-t p-3 md:grid-cols-3">
          {links.map((l, i) => (
            <a
              key={i}
              href={l.url}
              target="_blank"
              rel="nofollow noopener"
              className="flex items-center justify-between gap-2 rounded-lg border px-2 py-2 text-xs hover:bg-[rgb(var(--accent))]/40 border-black/10 dark:border-white/15"
            >
              <span className="truncate">{l.label}</span>
              <span className="shrink-0 muted">{domain(l.url)}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BestList({ items }: { items: Product[] }) {
  const sorted = React.useMemo(
    () =>
      [...items]
        .map((p) => ({ ...p, score: avg(p) }))
        .sort((a, b) => b.score - a.score || a.price - b.price || a.brand.localeCompare(b.brand)),
    [items]
  );

  return (
    <section className="grid gap-5">
      {sorted.map((p, idx) => (
        <article key={`${p.brand}-${p.model}`} className="card p-5">
          {/* Header row */}
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1.5">
              <h2 className="text-xl font-semibold">{idx + 1}. {p.brand} {p.model}</h2>
              <div className="flex flex-wrap items-center gap-2">
                {p.badges.map((b) => (
                  <span key={b} className="chip bg-slate-50 dark:bg-slate-900/30">{b}</span>
                ))}
              </div>
              <div className="text-sm muted">MSRP: ${p.price} • Sampled: {p.last_sampled}</div>
            </div>

            {/* Overall score */}
            <div className="shrink-0 rounded-xl border px-3 py-2 text-center">
              <div className="text-xs uppercase tracking-wide muted">BestPick</div>
              <div className="text-3xl font-bold leading-none">
                {p.score.toFixed(2)} <span className="text-2xl">{weather(p.score)}</span>
              </div>
              <div className="mt-1 text-xs muted">Avg of 4 buckets</div>
            </div>
          </div>

          {/* Per-bucket score chips */}
          <div className="mt-3 flex flex-wrap gap-2">
            <ScoreChip label="Published" value={p.published} tone={toneFor(p.published)} />
            <ScoreChip label="Reddit"    value={p.reddit}    tone={toneFor(p.reddit)} />
            <ScoreChip label="YouTube"   value={p.youtube}   tone={toneFor(p.youtube)} />
            <ScoreChip label="Social"    value={p.social}    tone={toneFor(p.social)} />
          </div>

          {/* Sources */}
          <div className="mt-4 grid gap-3">
            <Bucket title="Published" score={p.published} links={p.links.published} />
            <Bucket title="Reddit"    score={p.reddit}    links={p.links.reddit} />
            <Bucket title="YouTube"   score={p.youtube}   links={p.links.youtube} />
            <Bucket title="Social / Reporting" score={p.social} links={p.links.social} />
          </div>

          {/* CTA */}
          <div className="mt-4">
            <a href={p.affiliate.url} target="_blank" rel="nofollow noopener" className="btn">
              View at {p.affiliate.retailer}
            </a>
          </div>
        </article>
      ))}
    </section>
  );
}
