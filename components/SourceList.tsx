// components/SourceList.tsx
"use client";

import type { Source } from "@/types/domain";

export default function SourceList({ sources }: { sources: Source[] }) {
  if (!sources?.length) return null;

  return (
    <div className="mt-3 border-t pt-3">
      <div className="text-xs font-semibold text-gray-500 mb-2">Sources</div>
      <ul className="space-y-1">
        {sources.map((s, i) => (
          <li key={`${s.name}-${i}`} className="text-sm text-gray-700">
            <span
              className={`inline-block w-2 h-2 rounded-full mr-2 align-middle ${
                s.sentiment === "positive"
                  ? "bg-green-500"
                  : s.sentiment === "negative"
                  ? "bg-red-500"
                  : "bg-gray-400"
              }`}
            />
            {s.url ? (
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:no-underline"
              >
                {s.name}
              </a>
            ) : (
              <span>{s.name}</span>
            )}
            <span className="text-gray-400 text-xs ml-2">
              · weight {Math.round(s.weight * 100)}%
            </span>
            {s.snippet && (
              <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                “{s.snippet}”
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
