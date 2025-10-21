import fs from "node:fs";
import path from "node:path";

type LinkItem = { label: string; url: string };
type Product = {
  brand: string; model: string; price: number; badges: string[];
  published: number; reddit: number; youtube: number; social: number;
  last_sampled: string; affiliate: { retailer: string; url: string };
  links: { published: LinkItem[]; reddit: LinkItem[]; youtube: LinkItem[]; social: LinkItem[] };
};

function isHttps(u: string) {
  try { const x = new URL(u); return x.protocol === "https:"; } catch { return false; }
}

function validateFile(file: string) {
  const raw = fs.readFileSync(file, "utf-8");
  const items = JSON.parse(raw) as Product[];
  const errors: string[] = [];

  items.forEach((p, idx) => {
    const id = `${p.brand} ${p.model} (#${idx + 1})`;
    // scores
    ["published", "reddit", "youtube", "social"].forEach((k) => {
      const v = (p as any)[k];
      if (typeof v !== "number" || v < 1 || v > 5) errors.push(`${id}: score ${k} must be 1..5`);
    });
    // links
    (["published", "reddit", "youtube", "social"] as const).forEach((bucket) => {
      const arr = p.links?.[bucket];
      if (!Array.isArray(arr) || arr.length !== 3) errors.push(`${id}: bucket ${bucket} must have exactly 3 links`);
      else arr.forEach((l, i) => {
        if (!l.label || !l.url || !isHttps(l.url)) errors.push(`${id}: ${bucket}[${i}] must have https label+url`);
      });
    });
    // affiliate
    if (!p.affiliate?.url || !isHttps(p.affiliate.url)) errors.push(`${id}: affiliate.url must be https`);
  });

  if (errors.length) {
    console.error(`\nValidation failed for ${file}:\n- ` + errors.join("\n- "));
    process.exit(1);
  } else {
    console.log(`OK: ${file} (${items.length} products)`);
  }
}

const files = [
  path.join(process.cwd(), "data", "shoes", "best-mens-trail.json"),
  path.join(process.cwd(), "data", "shoes", "best-womens-trail.json")
];

files.forEach(validateFile);
