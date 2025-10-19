// components/ResultCard.tsx
import React from "react";
import type { PickItem } from "@/lib/fetchTop";
import ScoreBadge from "@/components/ScoreBadge";
import SourceChips from "@/components/SourceChips";

export default function ResultCard({ item }: { item: PickItem }) {
  return (
    <article className="rounded-2xl border p-5 hover:shadow transition">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-gray-500">#{item.rank}</div>
          <h3 className="text-lg font-semibold leading-snug">{item.title}</h3>
          {item.price && <div className="mt-1 text-sm text-gray-700">{item.price}</div>}
        </div>

        <div className="flex flex-col items-end gap-2">
          {item.badge && (
            <span className="rounded-full border px-3 py-1 text-xs font-medium">
              {item.badge}
            </span>
          )}
          <ScoreBadge score={item.score} confidence={item.confidence} />
        </div>
      </div>

      {item.highlights?.length ? (
        <ul className="mt-3 list-disc pl-5 text-sm text-gray-700 space-y-1">
          {item.highlights.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4">
        <SourceChips sources={item.sources} />
      </div>

      <div className="mt-5">
        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener nofollow"
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm hover:shadow transition"
          >
            Check price →
          </a>
        ) : (
          <button
            disabled
            className="cursor-not-allowed inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm opacity-50"
          >
            Link coming soon
          </button>
        )}
      </div>
    </article>
  );
}
