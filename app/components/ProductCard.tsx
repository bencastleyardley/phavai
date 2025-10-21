import React from "react";
import type { Product, SourceLink } from "@/lib/types";

function badgeColor(name: string) {
  if (name.toLowerCase().includes("overall")) return "bg-emerald-600 text-white";
  if (name.toLowerCase().includes("value")) return "bg-amber-600 text-white";
  return "bg-slate-800 text-slate-100";
}

function weatherEmoji(score: number) {
  if (score >= 4.5) return "☀️";
  if (score >= 4.2) return "🌤️";
  if (score >= 3.8) return "☁️";
  return "🌧️";
}

function LinkList({ label, items }: { label: string; items: SourceLink[] }) {
  if (!items?.length) return null;
  return (
    <div className="mt-3">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <ul className="mt-1 space-y-1">
        {items.slice(0,3).map((l, i) => (
          <li key={i}>
            <a href={l.url} className="underline decoration-dotted underline-offset-2 hover:opacity-80">
              {l.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ProductCard({ p, index }: { p: Product; index: number }) {
  return (
    <article className="rounded-2xl border border-slate-200/20 bg-white/80 backdrop-blur p-4 shadow-sm hover:shadow-md transition">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-slate-500">#{index + 1}</div>
          <h3 className="text-lg font-semibold leading-tight">
            {p.brand} <span className="text-slate-500">{p.model}</span>
          </h3>
          <div className="mt-1 text-sm text-slate-600">${p.price}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl" title="BestPick Score">
            {weatherEmoji(p.bestPick)}
          </span>
          <span className="text-xl font-bold tabular-nums">{p.bestPick.toFixed(2)}</span>
        </div>
      </header>

      {p.badges?.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {p.badges.map((b) => (
            <span key={b} className={`px-2 py-1 rounded-full text-xs ${badgeColor(b)}`}>{b}</span>
          ))}
        </div>
      ) : null}

      <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div className="rounded-lg bg-slate-50 p-2">
          <dt className="text-slate-500">Published</dt>
          <dd className="font-medium">{p.published.toFixed(2)}</dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-2">
          <dt className="text-slate-500">Reddit</dt>
          <dd className="font-medium">{p.reddit.toFixed(2)}</dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-2">
          <dt className="text-slate-500">YouTube</dt>
          <dd className="font-medium">{p.youtube.toFixed(2)}</dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-2">
          <dt className="text-slate-500">Social</dt>
          <dd className="font-medium">{p.social.toFixed(2)}</dd>
        </div>
      </dl>

      <div className="mt-2 text-xs text-slate-500">
        Last sampled: {new Date(p.lastSampled).toLocaleDateString()}
      </div>

      <div className="mt-3 grid sm:grid-cols-2 gap-4">
        <LinkList label="Published" items={p.links.published} />
        <LinkList label="Reddit" items={p.links.reddit} />
        <LinkList label="YouTube" items={p.links.youtube} />
        <LinkList label="Social" items={p.links.social} />
      </div>
    </article>
  );
}
