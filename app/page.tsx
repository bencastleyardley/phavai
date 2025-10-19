// app/page.tsx
import React from "react";
import TileCard from "@/components/TileCard";

const tiles = [
  {
    title: "Trail Running Shoes",
    query: "best trail running shoes 2025",
    subtitle: "Top picks & value buys",
  },
  {
    title: "Treadmills for Small Spaces",
    query: "best compact treadmill 2025",
    subtitle: "Quiet, foldable, under $1,000",
  },
  {
    title: "Budget Smartwatches",
    query: "best budget gps running watch",
    subtitle: "Accurate GPS without the $$$",
  },
  {
    title: "Everyday Headphones",
    query: "best wireless noise cancelling headphones 2025",
    subtitle: "Comfy fit, great battery life",
  },
];

export default function HomePage() {
  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <header className="mb-10">
        <h1 className="text-4xl font-semibold tracking-tight">Phavai</h1>
        <p className="mt-2 text-gray-600">
          The internet’s opinion, distilled. Click a tile or search directly to
          see transparent scores, confidence, and sources.
        </p>
      </header>

      <section>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((t) => (
            <TileCard
              key={t.title}
              title={t.title}
              query={t.query}
              subtitle={t.subtitle}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
