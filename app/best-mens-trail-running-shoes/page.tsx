import type { Metadata } from "next";
import data from "@/data/shoes/trail_men.json";
import type { Product } from "@/types/product";
import ProductCard from "@/components/ProductCard";

export const metadata: Metadata = {
  title: "Best Men's Trail Running Shoes — Phavai",
  description:
    "Top men’s trail shoes ranked by Phavai’s BestPick score from published reviews, Reddit, YouTube, and social sentiment. Static, fast, and transparent.",
  alternates: { canonical: "/best-mens-trail-running-shoes" },
  openGraph: {
    title: "Best Men's Trail Running Shoes — Phavai",
    description:
      "Phavai’s transparent rankings for men’s trail shoes, compiled from expert reviews and community sentiment.",
    url: "/best-mens-trail-running-shoes",
    type: "website"
  }
};

const sortProducts = (list: Product[]) => [...list].sort((a, b) => b.bestPick - a.bestPick);

export default function Page() {
  const products = sortProducts(data as Product[]);
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">
          Best <span className="text-emerald-600">Men’s</span> Trail Running Shoes
        </h1>
        <p className="text-slate-600">
          Phavai’s <span className="font-medium">BestPick</span> = average of{" "}
          <span className="font-medium">Published</span>, <span className="font-medium">Reddit</span>,{" "}
          <span className="font-medium">YouTube</span>, and <span className="font-medium">Social</span> sentiment.
          Scores are updated when we rebuild the site.
        </p>
        <div className="text-xs text-slate-500">
          Sources are linked on each card for full transparency.
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
