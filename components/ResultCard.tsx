import React from "react";
import type { PickItem } from "@/lib/fetchTop";

export default function ResultCard({ item }: { item: PickItem }) {
  return (
    <article className="rounded-2xl border bg-white p-5 hover:shadow transition">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-gray-500">#{item.rank}</div>
          <h3 className="text-lg font-semibold leading-snug">{item.title}</h3>
          {item.price && <div className="mt-1 text-sm text-gray-700">{item.price}</div>}
        </div>

        <div className="flex flex-col items-end gap-2">
          {item.badge && (
            <span className="rounded-full border px-3 py-1 text-xs font-medium bg-white">
              {item.badge}
            </span>
          )}
          <div className="inline-flex items-center gap-2 rounded-xl border px-3 py-1 text-sm bg-white">
            <span className="font-semibold">{item.score}/100</span>
            <span className="text-xs text-gray-500">{Math.round(item.confidence * 100)}% conf</span>
          </div>
        </div>
      </div>

      {item.highlights?.length ? (
        <ul className="mt-3 list-disc pl-5 text-sm text-gray-700 space-y-1">
          {item.highlights.map((h, i) => (<li key={i}>{h}</li>))}
        </ul>
      ) : null}

      {item.sources?.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {item.sources.map((s, i) => (
            <span key={i} className="rounded-full border px-2 py-1 text-xs bg-white">
              {label(s.type)}: {s.count}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-5">
        <a
          href={`/go/${slugify(item.title)}`}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm hover:shadow transition bg-white"
        >
          Check price →
        </a>
      </div>
    </article>
  );
}

function label(t: "reddit" | "youtube" | "review" | "other") {
  return t === "reddit" ? "Reddit" : t === "youtube" ? "YouTube" : t === "review" ? "Pro Reviews" : "Other";
}
function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
