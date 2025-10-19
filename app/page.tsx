// app/page.tsx
"use client";

import { useMemo, useState } from "react";
import TileCard from "@/components/TileCard";
import type { Tile } from "@/types/domain";
import { runAnalyze } from "@/lib/analyze";

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [tiles, setTiles] = useState<Tile[]>([
    {
      id: "1",
      title: "Laptop: Best Value Under $1000",
      buckets: ["Performance", "Battery", "Value"],
      price: "$799–$999",
      badges: ["Editor’s Choice"],
      references: ["Reddit", "YouTube", "Published Reviews"],
    },
    {
      id: "2",
      title: "Wireless ANC Headphones",
      buckets: ["Sound", "Comfort", "Features"],
      price: "$249–$399",
      badges: ["Top Rated"],
      references: ["Reddit", "YouTube", "Published Reviews"],
    },
    {
      id: "3",
      title: "Trail Running Shoe (Neutral)",
      buckets: ["Fit", "Grip", "Durability"],
      price: "$139–$189",
      badges: ["Runner Favorite"],
      references: ["Reddit", "YouTube", "Published Reviews"],
    },
  ]);

  const hasLoading = useMemo(() => tiles.some(t => t.isLoading), [tiles]);

  const handleAnalyze = async (tile: Tile) => {
    setTiles(prev =>
      prev.map(t => (t.id === tile.id ? { ...t, isLoading: true, error: null } : t))
    );
    try {
      const q =
        query.trim() ||
        tile.title ||
        "Popular consumer product with enough reviews to analyze";
      const result = await runAnalyze(q);
      setTiles(prev =>
        prev.map(t =>
          t.id === tile.id ? { ...t, isLoading: false, analysis: result } : t
        )
      );
    } catch (e: any) {
      setTiles(prev =>
        prev.map(t =>
          t.id === tile.id
            ? { ...t, isLoading: false, error: e?.message || "Failed to analyze." }
            : t
        )
      );
    }
  };

  const addTile = () => {
    const title = query.trim();
    if (!title) return;
    const id = String(Date.now());
    const newTile: Tile = {
      id,
      title,
      buckets: ["Performance", "Design", "Value"],
      price: "—",
      badges: ["New"],
      references: ["Reddit", "YouTube", "Published Reviews"],
    };
    setTiles(prev => [newTile, ...prev]);
    setQuery("");
  };

  return (
    <main className="pb-16">
      <header className="bg-white/70 backdrop-blur border-b">
        <div className="container py-8">
          <h1 className="text-4xl font-semibold tracking-tight">
            The Internet’s Opinion, Distilled
          </h1>
          <p className="mt-2 text-gray-600">
            One trusted score with transparent reasoning — built from reviews, forums, and videos.
          </p>

          <div className="mt-6 flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Try: 'Best ultralight laptop 14-inch' or 'Trail shoe for wide feet'"
              className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
            />
            <button
              onClick={addTile}
              className="rounded-xl bg-black text-white text-sm px-5 hover:bg-gray-800 transition disabled:opacity-50"
              disabled={!query.trim() || hasLoading}
            >
              Add
            </button>
          </div>
        </div>
      </header>

      <section className="container mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => (
          <TileCard key={tile.id} tile={tile} onAnalyze={handleAnalyze} />
        ))}
      </section>

      <footer className="container mt-16 text-xs text-gray-500">
        <div className="border-t pt-6">
          Built with care. Scores are synthesized estimates; always review sources.
        </div>
      </footer>
    </main>
  );
}
