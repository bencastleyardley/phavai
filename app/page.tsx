"use client";
import { useState } from "react";

type Buckets = { pro: number; reddit: number; forum: number; youtube: number };
type SourceItem = {
  id: string; type: "pro" | "reddit" | "forum" | "youtube";
  title: string; url: string; excerpt?: string;
  sentiment: -1 | -0.5 | 0 | 0.5 | 1;
  confidence: number; ageDays: number; credibility: number;
};
type ScorePayload = {
  query: string; bestPickScore: number; confidence: number;
  buckets: Buckets; sources: SourceItem[]; notes?: string[];
};

export default function Home() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<ScorePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr(null); setData(null);
    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Request failed");
      setData(json as ScorePayload);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-4xl p-6 space-y-6">
        <h1 className="text-3xl font-semibold">Phavai — The Internet’s Opinion, Distilled</h1>

        <form onSubmit={run} className="flex gap-3">
          <input
            value={query}
            onChange={(e)=>setQuery(e.target.value)}
            placeholder='Try: "best trail running shoes"'
            className="flex-1 rounded-lg border bg-white px-3 py-2 outline-none focus:ring"
          />
          <button
            className="rounded-lg bg-indigo-600 px-4 py-2 text-white disabled:opacity-60"
            disabled={loading || !query.trim()}
          >
            {loading ? "Scoring…" : "Get Score"}
          </button>
        </form>

        {err && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{err}</div>}

        {data && (
          <section className="space-y-6">
            {/* Score card */}
            <div className="rounded-2xl bg-white shadow p-6 flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-sm text-gray-500">BestPick Score</div>
                <div className="text-5xl font-bold">{data.bestPickScore}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Confidence</div>
                <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1">
                  <span className="text-lg font-semibold">{data.confidence}</span>
                  <span className="text-xs text-gray-500">/ 100</span>
                </div>
              </div>
            </div>

            {/* Buckets */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                ["Professional", data.buckets.pro],
                ["Social (Reddit)", data.buckets.reddit],
                ["Video (YouTube)", data.buckets.youtube],
              ].map(([label, value]) => (
                <div key={label as string} className="rounded-2xl bg-white shadow p-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-600">{label}</span>
                    <span className="font-semibold">{value as number}</span>
                  </div>
                  <div className="h-2 w-full rounded bg-gray-200 overflow-hidden">
                    <div className="h-full" style={{ width: `${value}%` }} />
                  </div>
                </div>
              ))}
              <div className="rounded-2xl bg-white shadow p-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-600">Forums</span>
                  <span className="font-semibold">{data.buckets.forum}</span>
                </div>
                <div className="h-2 w-full rounded bg-gray-200 overflow-hidden">
                  <div className="h-full" style={{ width: `${data.buckets.forum}%` }} />
                </div>
              </div>
            </div>

            {/* Sources */}
            <div className="rounded-2xl bg-white shadow">
              <div className="border-b px-6 py-4 font-medium">Sources ({data.sources.length})</div>
              <ul className="divide-y">
                {data.sources.map((s) => (
                  <li key={s.id} className="p-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs rounded-full px-2 py-0.5 border">
                          {s.type.toUpperCase()}
                        </span>
                        <a href={s.url} target="_blank" className="font-medium hover:underline">
                          {s.title}
                        </a>
                      </div>
                      {s.excerpt && <p className="text-sm text-gray-600 mt-1">{s.excerpt}</p>}
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="rounded-full px-2 py-0.5 border">{s.sentiment > 0 ? "👍" : s.sentiment < 0 ? "👎" : "↔️"} {s.sentiment}</span>
                      <span className="text-gray-500">age: {s.ageDays}d</span>
                      <span className="text-gray-500">conf: {(s.confidence*100).toFixed(0)}%</span>
                      <span className="text-gray-500">cred: {(s.credibility*100).toFixed(0)}%</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {data.notes?.length ? (
              <div className="text-xs text-gray-500">
                {data.notes.map((n, i) => <div key={i}>• {n}</div>)}
              </div>
            ) : null}
          </section>
        )}

        {!data && !loading && (
          <p className="text-sm text-gray-500">Type a product/topic and we’ll compute a BestPick Score with transparent source weighting.</p>
        )}
      </div>
    </main>
  );
}
