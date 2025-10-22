// app/lib/schema.ts
import type { Product } from "./types";

export function itemListJsonLd(opts: {
  pageTitle: string;
  pageUrl: string;
  items: Product[];
}) {
  const list = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: opts.pageTitle,
    itemListElement: opts.items.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${opts.pageUrl}#${slugify(p.brand + " " + p.model)}`,
      name: `${p.brand} ${p.model}`,
    })),
  };
  return JSON.stringify(list);
}

export function productJsonLd(p: Product, pageUrl: string) {
  const data = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: `${p.brand} ${p.model}`,
    sku: p.sku ?? undefined,
    brand: { "@type": "Brand", name: p.brand },
    category: p.category,
    url: `${pageUrl}#${slugify(p.brand + " " + p.model)}`,
    offers: p.affiliates?.map((a) => ({
      "@type": "Offer",
      price: a.price ?? undefined,
      priceCurrency: a.currency ?? "USD",
      url: a.url,
      availability: "https://schema.org/InStock",
      seller: { "@type": "Organization", name: a.retailer },
    })),
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: p.bestPick / 20, // convert 0–100 to 0–5
      ratingCount: Math.max(12, Math.round(p.sources?.published?.length ?? 5)),
      bestRating: 5,
      worstRating: 0,
    },
  };
  return JSON.stringify(data);
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}
