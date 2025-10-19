// components/SourceChips.tsx
import React from "react";
import type { SourceMix } from "@/lib/fetchTop";

const LABEL: Record<SourceMix["type"], string> = {
  reddit: "Reddit",
  youtube: "YouTube",
  review: "Pro Reviews",
  other: "Other",
};

export default function SourceChips({ sources = [] as SourceMix[] }) {
  if (!sources?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {sources.map((s, i) => (
        <span key={i} className="rounded-full border px-2 py-1 text-xs">
          {LABEL[s.type]}: {s.count}
        </span>
      ))}
    </div>
  );
}
