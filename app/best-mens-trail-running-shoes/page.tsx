// app/best-mens-trail-running-shoes/page.tsx
import { getReviewerTiers, getTrailMens } from "@/app/lib/data";
import { itemListJsonLd, productJsonLd } from "@/app/lib/schema";
import ProductCard from "@/app/components/cards/ProductCard";

export const dynamic = "error"; // SSG only

export const metadata = {
  title: "Best Men's Trail Running Shoes (2025) — Phavai",
  description:
    "Transparent, static review aggregator: published reviews, Reddit, YouTube, and social scores, rolled into a BestPick out of 100.",
};

export default async function Page() {
  const [items, tiers] = await Promise.all([getTrailMens(), getReviewerTiers()]);
  const pageUrl = "https://www.phavai.com/best-mens-trail-running-shoes";

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <h1 className="text-2xl font-bold">
        Best Men’s Trail Running Shoes (2025)
      </h1>
      <p className="text-slate-600">
        We combine four visible signals—Published, Reddit, YouTube, and Social—
        and show the roll-up BestPick score. Every link is cited with a reviewer
        tier badge for transparent credibility.
      </p>

      {/* ItemList JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: itemListJsonLd({ pageTitle: metadata.title, pageUrl, items }),
        }}
      />

      <div className="grid gap-6">
        {items.map((p, i) => (
          <div key={i}>
            {/* Per-product JSON-LD */}
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
