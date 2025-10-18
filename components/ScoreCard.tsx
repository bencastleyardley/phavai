import React from "react";

type Buckets = { pro: number; reddit: number; forum: number; youtube: number };

export function ScoreCard(props: {
  rank: number;
  name: string;
  score: number;
  confidence: number;
  buckets: Buckets;
  onAnalyze?: () => void;
}) {
  const { rank, name, score, confidence, buckets, onAnalyze } = props;

  const Bar = ({ value }: { value: number }) => (
    <div className="h-2 w-full rounded bg-gray-200 overflow-hidden">
      <div className="h-full" style={{ width: `${value}%` }} />
    </div>
  );

  return (
    <div className="rounded-2xl bg-white shadow p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-500">#{rank}</div>
          <div className="font-semibold">{name}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">BestPick Score</div>
          <div className="text-3xl font-bold leading-none">{score}</div>
          <div className="mt-1 text-xs text-gray-500">
            Confidence <span className="font-medium">{confidence}</span>/100
          </div>
        </div>
      </div>

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
