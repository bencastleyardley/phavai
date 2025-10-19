// components/TileCard.tsx
"use client";

import type { Tile } from "@/types/domain";
import ScoreBadge from "@/components/ScoreBadge";
import SourceList from "@/components/SourceList";

type Props = {
  tile: Tile;
  onAnalyze: (tile: Tile) => void;
};

export default function TileCard({ tile, onAnalyze }: Props) {
  const { analysis, isLoading, error } = tile;

  return (
    <div
      className="bg-white rounded-2xl shadow-sm hover:shadow-md transition p-6 flex flex-col justify-between border border-gray-100"
      data-tile-id={tile.id}
    >
      <div>
        <h2 className="text-xl font-bold mb-2">{tile.title}</h2>

        <ul className="mb-4 text-sm text-gray-700 space-y-1">
          {tile.buckets.map((b) => (
            <li key={b}>• {b}</li>
          ))}
        </ul>

        <div className="text-gray-900 font-semibold mb-3">{tile.price}</div>

        {tile.badges && tile.badges.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {tile.badges.map((badge) => (
              <span
                key={badge}
                className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full"
              >
                {badge}
              </span>
            ))}
          </div>
        )}

        {analysis ? (
          <div className="mt-2">
            <ScoreBadge
              score={analysis.bestPick.score}
              confidence={analysis.bestPick.confidence}
            />
            <p className="text-sm text-gray-700 mt-2">{analysis.summary}</p>

            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div className="rounded-lg bg-gray-50 p-2">
                Published: {Math.round(analysis.bestPick.breakdown.publishedReviews)}
              </div>
              <div className="rounded-lg bg-gray-50 p-2">
                Reddit: {Math.round(analysis.bestPick.breakdown.redditSentiment)}
              </div>
              <div className="rounded-lg bg-gray-50 p-2">
                Video: {Math.round(analysis.bestPick.breakdown.videoSentiment)}
              </div>
              <div className="rounded-lg bg-gray-50 p-2">
                Recency: {Math.round(analysis.bestPick.breakdown.recencyBoost)}
              </div>
            </div>

            <SourceList sources={analysis.sources} />
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            No analysis yet — click Analyze to generate the Phavai score with a transparent breakdown.
          </p>
        )}

        {error && (
          <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
            {error}
          </div>
        )}
      </div>

      <button
        onClick={() => onAnalyze(tile)}
        disabled={isLoading}
        className={`mt-4 rounded-lg py-2 px-4 text-sm transition ${
          isLoading
            ? "bg-gray-300 text-gray-600 cursor-not-allowed"
            : "bg-black text-white hover:bg-gray-800"
        }`}
      >
        {isLoading ? "Analyzing…" : "Analyze"}
      </button>
    </div>
  );
}
