// app/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type BaseItem = {
  id: string;
  source: "reddit" | "youtube" | "web";
  title: string;
  url: string;
  author?: string;
  thumbnail?: string;
  snippet?: string;
  publishedAt?: string;
  upvotes?: number;
  views?: number;
  score: number; // from /api/search
};

type AnalyzedItem = BaseItem & {
  product?: string;
  pros?: string[];
  cons?: string[];
  verdict?: string;
  bestPickScore?: number; // refined by /api/analyze
};

export default function Home() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AnalyzedItem[]>([]);
  const [meta, setMeta] = useState<{ query?: string; counts?: Record<string, number> } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSearch = q.trim().length > 1;

  async function runSearch(term: string) {
    setLoading(true);
    setError(null);
    try {
      // 1) Fetch raw Top 10 from sources (Reddit/YouTube/Web)
      const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      const data = await res.json();

      let top: AnalyzedItem[] = data.items || [];
      setMeta({ query: data.query, counts: data.counts });

      // 2) Enrich with OpenAI (pros/cons/verdict/refined score) if key is set on server
      try {
        const ares = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: top, query: data.query }),
        });
        if (ares.ok) {
          const analyzed = await ares.json();
          const enriched: AnalyzedItem[] = analyzed.items || top;
          setItems(enriched);
        } else {
          // Fallback to raw items if analysis fails
          setItems(top);
        }
      } catch {
        setItems(top);
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Something went wrong.");
      setItems([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Hydrate from ?q= if present
    const params = new URLSearchParams(window.location.search);
    const pre = params.get("q");
    if (pre) {
      setQ(pre);
      runSearch(pre);
    }
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSearch) return;
    const s = q.trim();
    const u = new URL(window.location.href);
    u.searchParams.set("q", s);
    window.history.replaceState({}, "", u.toString());
    runSearch(s);
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <section className="max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-3xl md:text-5xl font-semibold tracking-tight">
            Phavai — The Internet’s Opinion, Distilled
          </h1>
          <p className="text-neutral-400 mt-3">
            Search any product. We scan Reddit, YouTube, and pro reviews to give you a Top 10 you can trust.
          </p>
        </header>

        {/* Search Bar */}
        <form onSubmit={onSubmit} className="flex gap-2 justify-center">
          <input
            className="w-full max-w-2xl rounded-2xl bg-neutral-900 border border-neutral-800 px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="e.g., best trail running shoes 2025"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            disabled={!canSearch || loading}
            className="rounded-2xl px-5 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40"
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </form>

        {/* Meta / Error */}
        {meta?.query && (
          <div className="mt-6 text-sm text-neutral-400 text-center">
            Showing Top 10 for <span className="text-neutral-200">“{meta.query}”</span>
            {meta.counts && (
              <> · sources: reddit {meta.counts.reddit}, youtube {meta.counts.youtube}, web {meta.counts.web}</>
            )}
          </div>
        )}
        {error && (
          <div className="mt-6 text-center text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Results */}
        <ul className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-5">
          {items.map((it, idx) => {
            const finalScore = typeof it.bestPickScore === "number" ? it.bestPickScore : it.score;
            const product = it.product || it.title;

            return (
              <li
                key={it.id}
                className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 hover:border-neutral-700 transition"
              >
                <div className="flex gap-4">
                  {/* Thumbnail */}
                  {it.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.thumbnail} alt="" className="w-24 h-24 object-cover rounded-xl" />
                  ) : (
                    <div className="w-24 h-24 rounded-xl bg-neutral-800" />
                  )}

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    {/* Title + Score */}
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="text-base font-medium leading-tight line-clamp-2">
                        <span className="text-neutral-400 mr-2">#{idx + 1}</span>
                        {product}
                      </h3>
                      <span
                        title="BestPick score"
                        className="shrink-0 rounded-xl px-2 py-1 text-xs bg-emerald-700/20 border border-emerald-700/40"
                      >
                        {finalScore}
                      </span>
                    </div>

                    {/* Source + Meta */}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                      <span className="rounded-lg border border-neutral-700 px-2 py-[2px]">
                        {it.source}
                      </span>
                      {it.author && <span>· {it.author}</span>}
                      {it.views && <span>· {Intl.NumberFormat().format(it.views)} views</span>}
                      {it.upvotes && <span>· {it.upvotes} upvotes</span>}
                    </div>

                    {/* Snippet */}
                    {it.snippet && (
                      <p className="mt-2 text-sm text-neutral-300 line-clamp-2">{it.snippet}</p>
                    )}

                    {/* Pros / Cons */}
                    {(it.pros?.length || it.cons?.length) && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {it.pros?.length ? (
                          <div>
                            <div className="text-xs uppercase tracking-wider text-emerald-400 mb-1">Pros</div>
                            <ul className="text-sm text-neutral-200 list-disc pl-4 space-y-1">
                              {it.pros.slice(0, 4).map((p, i) => (
                                <li key={i}>{p}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {it.cons?.length ? (
                          <div>
                            <div className="text-xs uppercase tracking-wider text-red-300 mb-1">Cons</div>
                            <ul className="text-sm text-neutral-300 list-disc pl-4 space-y-1">
                              {it.cons.slice(0, 3).map((c, i) => (
                                <li key={i}>{c}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* Verdict */}
                    {it.verdict && (
                      <p className="mt-3 text-sm text-neutral-200 italic">
                        “{it.verdict}”
                      </p>
                    )}

                    {/* Actions */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href={it.url}
                        target="_blank"
                        className="text-sm rounded-lg px-3 py-2 bg-neutral-800 hover:bg-neutral-700"
                      >
                        Open source
                      </Link>
                      <Link
                        href={it.url}
                        target="_blank"
                        className="text-sm rounded-lg px-3 py-2 border border-emerald-700/50 hover:bg-emerald-700/10"
                      >
                        Buy / Learn more
                      </Link>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {/* Empty state */}
        {!loading && items.length === 0 && meta?.query && (
          <div className="text-center text-neutral-400 mt-10">
            No results yet. Try another query (brand + model) or add API keys for richer sources.
          </div>
        )}
      </section>
    </main>
  );
}
