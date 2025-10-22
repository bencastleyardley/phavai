// app/best-womens-trail-running-shoes/page.tsx
import { getReviewerTiers, getTrailWomens } from "@/app/lib/data";
import { itemListJsonLd, productJsonLd } from "@/app/lib/schema";
import ProductCard from "@/app/components/cards/ProductCard";

export const dynamic = "error"; // SSG only

export const metadata = {
  title: "Best Women's Trail Running Shoes (2025) — Phavai",
  description:
    "Static, trust-first review aggregator with transparent citations and BestPick scoring.",
};

export default async function Page() {
  const [items, tiers] = await Promise.all([
    getTrailWomens(),
    getReviewerTiers(),
  ]);
  const pageUrl = "https://www.phavai.com/best-womens-trail-running-shoes";

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <h1 className="text-2xl font-bold">
        Best Women’s Trail Running Shoes (2025)
      </h1>
      <p className="text-slate-600">
        Scores roll up public sentiment across Published reviews, Reddit,
        YouTube, and broader Social chatter. Sources are tiered for credibility.
      </p>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: itemListJsonLd({ pageTitle: metadata.title, pageUrl, items }),
        }}
      />

      <div className="grid gap-6">
        {items.map((p, i) => (
          <div key={i}>
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: productJsonLd(p, pageUrl) }}
            />
            <ProductCard p={p} tiers={tiers} rank={i + 1} />
          </div>
        ))}
      </div>
    </main>
  );
}
