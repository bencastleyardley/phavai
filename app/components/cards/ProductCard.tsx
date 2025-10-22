// app/components/cards/ProductCard.tsx
import Image from "next/image";
import ReviewerTierBadge from "../badges/ReviewerTierBadge";
import { sentimentIcon } from "@/app/lib/score";
import { slugify } from "@/app/lib/schema";
import type { Product } from "@/app/lib/types";

export default function ProductCard({
  p,
  tiers,
  rank,
}: {
  p: Product;
  tiers: Record<string, { tier: 1 | 2 | 3; label: string }>;
  rank: number;
}) {
  const anchor = slugify(`${p.brand} ${p.model}`);

  const ScorePill = ({ label, value }: { label: string; value: number }) => (
    <div className="flex items-center gap-1 rounded-full border px-2 py-1 text-xs">
      <span className="opacity-70">{label}</span>
      <span className="ml-1 font-semibold">{value}</span>
      <span>{sentimentIcon(value)}</span>
    </div>
  );

  const SourceRow = ({
    title,
    items,
  }: {
    title: string;
    items?: Product["sources"]["published"];
  }) =>
    items && items.length ? (
      <div className="space-y-1">
        <div className="text-[13px] font-semibold">{title}</div>
        <ul className="space-y-1">
          {items.map((s, i) => {
            const host = s.domain ?? safeHost(s.url);
            const t = tiers[host];
            return (
              <li key={i} className="flex items-center gap-2 text-sm">
                <a
                  href={s.url}
                  className="underline decoration-dotted hover:decoration-solid"
                  target="_blank"
                >
                  {s.title}
                </a>
                {t && <ReviewerTierBadge tier={t.tier} label={t.label} />}
                {s.lastSampled && (
                  <span className="text-xs text-slate-500">
                    · sampled {new Date(s.lastSampled).toLocaleDateString()}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    ) : null;

  return (
    <article
      id={anchor}
      className="grid grid-cols-1 gap-4 rounded-2xl border p-4 md:grid-cols-[140px,1fr] md:gap-6"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-slate-100 md:w-[140px]">
        {p.image && (
          <Image
            src={p.image}
            alt={`${p.brand} ${p.model}`}
            fill
            className="object-cover"
          />
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white">
              {rank}
            </span>
            <h3 className="text-lg font-semibold">
              {p.brand} {p.model}
            </h3>
            {p.badge && (
              <span className="rounded-full bg-indigo-600/15 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-600/30">
                {p.badge}
              </span>
            )}
          </div>
          {p.priceHint && (
            <div className="text-sm text-slate-600">{p.priceHint}</div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <ScorePill label="Published" value={p.scores.published} />
          <ScorePill label="Reddit" value={p.scores.reddit} />
          <ScorePill label="YouTube" value={p.scores.youtube} />
          <ScorePill label="Social" value={p.scores.social} />
          <div className="ml-2 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
            BestPick {p.bestPick}/100
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {p.affiliates?.map((a, i) => (
            <a
              key={i}
              href={a.url}
              target="_blank"
              className="rounded-xl border px-3 py-2 text-sm font-medium hover:bg-slate-50"
            >
              View at {a.retailer}
            </a>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <SourceRow title="Published reviews" items={p.sources?.published} />
          <SourceRow title="Reddit threads" items={p.sources?.reddit} />
          <SourceRow title="YouTube videos" items={p.sources?.youtube} />
          <SourceRow title="Social posts" items={p.sources?.social} />
        </div>
      </div>
    </article>
  );
}

function safeHost(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
