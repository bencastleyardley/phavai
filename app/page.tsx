// app/page.tsx
"use client";
import { useState } from "react";
import { ScoreCard } from "@/components/ScoreCard";
import type { SourceItem } from "@/lib/score";

type Buckets = { pro: number; reddit: number; forum: number; youtube: number };

type TopItem = {
  id: string;
  name: string;
  score: number;
  confidence: number;
  buckets: Buckets;
  price: number;
  volume: number;
  badges?: string[];
  references?: { label: string; url: string; kind: "pro" | "reddit" | "youtube" | "buyers" }[];
};

type ScorePayload = {
  query: string;
  bestPickScore: number;
  confidence: number;
  buckets: Buckets;
  sources: SourceItem[]; // <- no 'any'
  notes?: string[];
};

export default function Home() {
  const [query, setQuery] = useState("");
  const [scoreData, setScoreData] = useState<ScorePayload | null>(null);
  const [topData, setTopData] = useState<TopItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [searched, setSearched] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setErr(null);
    setScoreData(null);
    setTopData(null);
    setSearched(q);

    try {
      const [scoreRes, topRes] = await Promise.all([
        fetch("/api/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q }),
        }),
        fetch("/api/top", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q }),
        }),
      ]);

      const scoreJson: ScorePayload = await scoreRes.json();
      const topJson: { items: TopItem[] } = await topRes.json();

      if (!scoreRes.ok) throw new Error((scoreJson as any)?.error || "Score request failed");
      if (!topRes.ok) throw new Error((topJson as any)?.error || "Top request failed");

      setScoreData(scoreJson);
      setTopData(topJson.items);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-5xl p-6 space-y-8">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold">Phavai — The Internet’s Opinion, Distilled</h1>
        </header>

        {/* Search */}
        <section className="rounded-2xl bg-white shadow p-5">
          <form onSubmit={run} className="flex gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='e.g., "best trail running shoes"'
              className="flex-1 rounded-lg border bg-white px-3 py-2 outline-none focus:ring"
            />
            <button
              className="rounded-lg bg-indigo-600 px-4 py-2 text-white disabled:opacity-60"
              disabled={loading || !query.trim()}
            >
              {loading ? "Searching…" : "Search"}
            </button>
          </form>

          {err && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
              {err}
            </div>
          )}

          {scoreData && (
            <div className="mt-5 rounded-xl border p-4 flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">BestPick Score</div>
                <div className="text-4xl font-bold">{scoreData.bestPickScore}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Confidence</div>
                <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1">
                  <span className="text-lg font-semibold">{scoreData.confidence}</span>
                  <span className="text-xs text-gray-500">/ 100</span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Top 10 for this query */}
        {searched && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Top 10 for “{searched}”</h2>
              <span className="text-sm text-gray-500">Mocked results — wiring real sources next</span>
            </div>

            {loading && <div className="rounded-lg border bg-white p-4">Loading…</div>}

            {topData && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {topData.map((t, idx) => (
                  <ScoreCard
                    key={t.id}
                    rank={idx + 1}
                    name={t.name}
                    score={t.score}
                    confidence={t.confidence}
                    buckets={t.buckets}
                    price={t.price}
                    badges={t.badges}
                    references={t.references}
                    onAnalyze={() => {
                      setQuery(t.name);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
