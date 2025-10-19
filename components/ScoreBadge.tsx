// components/ScoreBadge.tsx
import React from "react";

export default function ScoreBadge({ score, confidence }: { score: number; confidence: number }) {
  const confPct = Math.round(confidence * 100);
  return (
    <div className="inline-flex items-center gap-2 rounded-xl border px-3 py-1 text-sm">
      <span className="font-semibold">{score}/100</span>
      <span className="text-xs text-gray-500">Confidence {confPct}%</span>
    </div>
  );
}
