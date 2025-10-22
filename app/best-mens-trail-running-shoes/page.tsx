import type { Metadata } from "next";
import fs from "node:fs";
import path from "node:path";
import BestList, { type Product } from "@/components/BestList";

const TITLE = "Best Men’s Trail Running Shoes (2025)";
const DESCRIPTION =
  "Transparent, static roundup: we average Published, Reddit, YouTube, and Social into one BestPick score. Real links, no fluff.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "https://phavai.vercel.app/best-mens-trail-running-shoes" },
  openGraph: { title: TITLE, description: DESCRIPTION, type: "article" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION }
};

function loadProducts(): Product[] {
  const file = path.join(process.cwd(), "data", "shoes", "best-mens-trail.json");
  return JSON.parse(fs.readFileSync(file, "utf-8")) as Product[];
}

export default function Page() {
  const items = loadProducts();

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
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{TITLE}</h1>
        <p className="mt-2 muted">{DESCRIPTION}</p>
        <p className="mt-1 text-sm muted">Last updated: {new Date().toLocaleDateString()}</p>
      </header>
      <BestList items={items} />
      <footer className="mt-10 text-sm muted">
        Methodology: 4-bucket average.{" "}
        <a className="underline hover:no-underline" href="/methodology">See our full methodology</a>.
      </footer>
    </main>
  );
}
