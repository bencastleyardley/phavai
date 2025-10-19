// components/ScoreCard.tsx
import React from "react";

type Buckets = { pro: number; reddit: number; forum: number; youtube: number };
type Reference = { label: string; url: string; kind: "pro" | "reddit" | "youtube" | "buyers" };

export function ScoreCard(props: {
  rank: number;
  name: string;
  score: number;
  confidence: number;
  buckets: Buckets;
  price: number; // <-- ensure this exists
  badges?: string[];
  references?: Reference[];
  onAnalyze?: () => void;
}) {
  const { rank, name, score, confidence, buckets, price, badges = [], references = [], onAnalyze } = props;

  const Bar = ({ value }: { value: number }) => (
    <div className="h-2 w-full rounded bg-gray-200 overflow-hidden">
      <div className="h-full bg-indigo-600/90" style={{ width: `${value}%` }} />
    </div>
  );

  const badgeColor = (b: string) =>
    b === "Best Overall" ? "bg-amber-200 text-amber-900"
    : b === "Best Value" ? "bg-emerald-200 text-emerald-900"
    : b === "Most Popular" ? "bg-rose-200 text-rose-900"
    : b === "Hidden Gem" ? "bg-sky-200 text-sky-900"
    : "bg-gray-200 text-gray-900";

  const icon = (k: Reference["kind"]) =>
    k === "pro" ? "🧠" : k === "reddit" ? "💬" : k === "youtube" ? "📹" : "🛒";

  return (
    <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5 p-5 flex flex-col gap-4 hover:shadow-md transition">
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-500 shrink-0">#{rank}</div>
            <h3 className="font-semibold leading-tight truncate">{name}</h3>
          </div>

          {/* Badges */}
          {!!badges.length && (
            <div className="mt-2 flex flex-wrap gap-2">
              {badges.map((b) => (
                <span key={b} className={`text-xs px-2 py-1 rounded-full font-medium ${badgeColor(b)}`}>
                  {b}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Score block */}
        <div className="text-right">
          <div className="text-xs text-gray-500">BestPick</div>
          <div className="text-3xl font-bold leading-none tracking-tight">{score}</div>
          <div className="mt-1 text-xs text-gray-500">
            Confidence <span className="font-medium">{confidence}</span>/100
          </div>
          <div className="mt-1 text-xs text-gray-500">
            Price <span className="font-medium">${price}</span>
          </div>
        </div>
      </div>

      {/* Buckets */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="flex items-center justify-between mb-1"><span className="text-gray-600">Professional</span><span className="font-medium">{buckets.pro}</span></div>
          <Bar value={buckets.pro} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1"><span className="text-gray-600">Reddit</span><span className="font-medium">{buckets.reddit}</span></div>
          <Bar value={buckets.reddit} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1"><span className="text-gray-600">Forums</span><span className="font-medium">{buckets.forum}</span></div>
          <Bar value={buckets.forum} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1"><span className="text-gray-600">YouTube</span><span className="font-medium">{buckets.youtube}</span></div>
          <Bar value={buckets.youtube} />
        </div>
      </div>

      {/* References */}
      {!!references.length && (
        <div className="pt-2 border-t">
          <div className="text-xs text-gray-500 mb-2">References</div>
          <div className="flex flex-wrap gap-3">
            {references.map((r) => (
              <a
                key={r.url + r.label}
                href={r.url}
                target="_blank"
                className="inline-flex items-center gap-1 text-xs underline underline-offset-2 text-gray-600 hover:text-gray-900"
              >
                <span>{icon(r.kind)}</span>
                <span>{r.label}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="flex justify-end">
        <button
          onClick={onAnalyze}
          className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Analyze this
        </button>
      </div>
    </div>
  );
}
