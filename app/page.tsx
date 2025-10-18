"use client";
import { useState } from "react";

export default function Home() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAnalyze(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Request failed");
      setResult(data.summary ?? "No summary returned.");
    } catch (err: any) {
      setError(err?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh flex items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow p-6 space-y-6">
        <h1 className="text-2xl font-semibold">Phavai — The Internet’s Opinion, Distilled</h1>

        <form onSubmit={runAnalyze} className="space-y-3">
          <label className="block text-sm font-medium">What should we analyze?</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='e.g., "best trail shoes"'
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring focus:ring-indigo-200"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-white disabled:opacity-50"
          >
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </form>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        {result && (
          <div className="rounded-lg border bg-gray-50 p-4">
            <div className="text-sm text-gray-500 mb-1">Result</div>
            <div className="whitespace-pre-wrap">{result}</div>
          </div>
        )}

        <p className="text-xs text-gray-400">
          Dev build — uses a placeholder summary. We’ll wire real OpenAI logic next.
        </p>
      </div>
    </main>
  );
}
