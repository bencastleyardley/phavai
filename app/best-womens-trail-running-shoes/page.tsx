import type { Metadata } from "next";
import fs from "node:fs";
import path from "node:path";
import BestList, { Product } from "@/components/BestList";
import { loadTierConfig } from "@/lib/tiers";

const TITLE = "Best Women’s Trail Running Shoes (2025)";
const DESCRIPTION =
  "Trusted, static roundup: averaged sentiment from Published, Reddit, YouTube, and Social into one BestPick score. Tier badges + transparent sources.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "https://phavai.vercel.app/best-womens-trail-running-shoes" },
  openGraph: { title: TITLE, description: DESCRIPTION, type: "article" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION }
};

function loadProducts(): Product[] {
  const file = path.join(process.cwd(), "data", "shoes", "best-womens-trail.json");
  return JSON.parse(fs.readFileSync(file, "utf-8")) as Product[];
}

function tierMapForClient() {
  const cfg = loadTierConfig("trail-running-shoes");
  const map: Record<string, { badge: string; tip: string }> = {};
  for (const t of cfg.tiers) for (const d of t.domains) map[d] = { badge: t.emoji, tip: `${t.label}: ${t.why_trusted}` };
  return map;
}

export default function Page() {
  const items = loadProducts();
  const tiers = tierMapForClient();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: TITLE,
    description: DESCRIPTION,
    itemListElement: items.map((p, i) => ({
      "@type": "Product",
      position: i + 1,
      name: `${p.brand} ${p.model}`,
      brand: p.brand,
      offers: { "@type": "Offer", price: p.price, priceCurrency: "USD", url: p.affiliate.url }
    }))
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script dangerouslySetInnerHTML={{ __html: `window.__TIERS__=${JSON.stringify(tiers)}` }} />
      <header className="mb-8">
        <nav className="mb-4 text-sm text-muted-foreground">
          <a className="hover:underline" href="/">Home</a> <span className="mx-1">/</span>
          <span>Best Women’s Trail Running Shoes</span>
        </nav>
        <h1 className="text-3xl font-bold tracking-tight">{TITLE}</h1>
        <p className="mt-2 text-muted-foreground">{DESCRIPTION}</p>
        <p className="mt-1 text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
      </header>
      <BestList items={items} vertical="trail-running-shoes" />
      <footer className="mt-10 text-sm text-muted-foreground">
        Methodology: 4-bucket average with reviewer tier badges for transparency.
        <a className="ml-2 underline hover:no-underline" href="/methodology">See our full methodology</a>.
      </footer>
    </main>
  );
}
