import type { Metadata } from "next";
import men from "@/data/shoes/trail_men.json";
import type { Product } from "@/lib/types";
import ProductCard from "@/app/components/ProductCard";

export const metadata: Metadata = {
  title: "Best Men's Trail Running Shoes (Top Picks) — Phavai",
  description:
    "Phavai’s static BestPick list for men's trail running shoes, distilled from published reviews, Reddit threads, YouTube videos, and social chatter.",
  alternates: { canonical: "/best-mens-trail-running-shoes" },
  openGraph: {
    title: "Best Men's Trail Running Shoes — Phavai",
    description:
      "Top men’s trail shoes ranked by Phavai’s BestPick score from published reviews, Reddit, YouTube, and social sentiment.",
    url: "/best-mens-trail-running-shoes",
    type: "website"
  }
};

function sortProducts(list: Product[]) {
  return [...list].sort((a, b) => b.bestPick - a.bestPick);
}

export default function Page() {
  const products = sortProducts(men as Product[]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">
          Best <span className="text-emerald-600">Men’s</span> Trail Running Shoes
        </h1>
        <p className="text-slate-600">
          Transparent rankings powered by the Phavai BestPick score — the average of{" "}
          <span className="font-medium">Published</span>, <span className="font-medium">Reddit</span>,{" "}
          <span className="font-medium">YouTube</span>, and <span className="font-medium">Social</span> sentiment.
        </p>
        <div className="text-xs text-slate-500">
          Data is static and updated manually with each site rebuild.
        </div>
      </header>

      <section className="grid gap-4 sm:gap-6">
        {products.map((p, i) => (
          <ProductCard key={`${p.brand}-${p.model}`} p={p} index={i} />
        ))}
      </section>
    </main>
  );
}
