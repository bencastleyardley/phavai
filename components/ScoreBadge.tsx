// components/ScoreBadge.tsx
"use client";

type Props = {
  score: number;       // 0..100
  confidence: number;  // 0..100
};

export default function ScoreBadge({ score, confidence }: Props) {
  const grade =
    score >= 90 ? "A+" :
    score >= 85 ? "A"  :
    score >= 80 ? "A-" :
    score >= 75 ? "B+" :
    score >= 70 ? "B"  :
    score >= 65 ? "B-" :
    score >= 60 ? "C"  :
    score >= 50 ? "D"  : "F";

  return (
    <div className="flex items-center gap-3">
      <div className="rounded-xl px-3 py-1 text-sm font-semibold bg-black text-white">
        {grade} · {Math.round(score)}
      </div>
      <div className="text-xs text-gray-500">
        Confidence: {Math.round(confidence)}%
      </div>
    </div>
  );
}
