"use client";
import React, { useEffect, useState } from "react";
import { fetchTopPicks, type TopResponse } from "@/lib/fetchTop";
import ResultCard from "@/components/ResultCard";
import { useSearchParams } from "next/navigation";

export default function SearchResults({ query }: { query: string }) {
  const [data, setData] = useState<TopResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(!!query);
  const [error, setError] = useState<string | null>(null);
  const sp = useSearchParams();
  const sort = sp.get("sort") ?? "score";

  useEffect(() => {
    let alive = true;
    if (!query) return;
    setLoading(true);
    setError(null);
    fetchTopPicks(query)
      .then((res) => { if (alive) setData(res); })
      .catch((e) => { if (alive) setError(e?.message || "Failed to load results."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [query]);

  function sortPicks() {
    if (!data) return null;
    const picks = [...data.picks];
    if (sort === "confidence") picks.sort((a, b) => b.confidence - a.confidence);
    else if (sort === "price") picks.sort((a, b) => (priceNum(a.price) - priceNum(b.price)));
    else picks.sort((a, b) => b.score - a.score);
    return picks;
  }

  if (!query) return null;
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-2xl border p-5 animate-pulse bg-white">
            <div className="h-4 w-16 bg-gray-200 rounded" />
            <div className="mt-2 h-6 w-3/4 bg-gray-200 rounded" />
            <div className="mt-1 h-4 w-40 bg-gray-200 rounded" />
            <div className="mt-4 space-y-2">
              <div className="h-3 w-full bg-gray-200 rounded" />
              <div className="h-3 w-5/6 bg-gray-200 rounded" />
              <div className="h-3 w-2/3 bg-gray-200 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (error) return <div className="rounded-2xl border p-6 text-sm text-red-600 bg-white">{error}</div>;
  if (!data || !data.picks?.length) return <div className="text-sm text-gray-500">No results yet.</div>;

  const ordered = sortPicks()!;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {ordered.map((p) => (<ResultCard key={`${p.rank}-${p.title}`} item={p} />))}
    </div>
  );
}

function priceNum(p?: string) {
  if (!p) return Number.POSITIVE_INFINITY;
  const m = p.match(/([\d,.]+)/);
  return m ? Number(m[1].replace(/,/g, "")) : Number.POSITIVE_INFINITY;
}
