import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

const OUTPUT_JSON = "exports/phavai-affiliate-readiness-report.json";
const OUTPUT_CSV = "exports/phavai-affiliate-readiness-report.csv";
const htmlFiles = readdirSync(process.cwd()).filter((file) => file.endsWith(".html")).sort();

function attr(tag, name) {
  return tag.match(new RegExp(`${name}="([^"]*)"`, "i"))?.[1] ?? "";
}

function decode(value = "") {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"");
}

function parseDomain(url = "") {
  try {
    return new URL(decode(url)).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function amazonStatus(url = "") {
  try {
    const parsed = new URL(decode(url));
    const isAmazon = /(^|\.)amazon\.com$/i.test(parsed.hostname);
    if (!isAmazon) return { isAmazon: false, issues: [] };

    const issues = [];
    if (!/(?:^|\/)(?:dp|gp\/product|gp\/aw\/d)\//i.test(parsed.pathname)) {
      issues.push("Amazon link is not an exact product detail URL");
    }
    if (!parsed.searchParams.get("tag")) {
      issues.push("Amazon link is missing affiliate tag");
    }

    return { isAmazon: true, issues };
  } catch {
    return { isAmazon: false, issues: ["Invalid URL"] };
  }
}

const rows = [];
const summary = {
  generated_at: new Date().toISOString(),
  purpose: "Checks built public pages for active shopping links. Non-Amazon retailer links are counted as valid retailer links and are not treated as Amazon affiliate cleanup work.",
  pages_checked: htmlFiles.length,
  active_shopping_links: 0,
  amazon_product_links: 0,
  amazon_links_needing_exact_product_url: 0,
  non_amazon_retail_links: 0,
  invalid_links: 0
};

for (const file of htmlFiles) {
  const html = readFileSync(file, "utf8");
  for (const match of html.matchAll(/<a[^>]+data-affiliate-link[^>]*>/g)) {
    const tag = match[0];
    const href = decode(attr(tag, "href"));
    const product = decode(attr(tag, "data-product-name"));
    const guide = decode(attr(tag, "data-guide"));
    const retailer = decode(attr(tag, "data-retailer")) || parseDomain(href) || "Retailer";
    const { isAmazon, issues } = amazonStatus(href);
    summary.active_shopping_links += 1;

    if (isAmazon) {
      if (issues.length) {
        summary.amazon_links_needing_exact_product_url += 1;
      } else {
        summary.amazon_product_links += 1;
      }
    } else if (issues.includes("Invalid URL")) {
      summary.invalid_links += 1;
    } else {
      summary.non_amazon_retail_links += 1;
    }

    if (issues.length) {
      rows.push({ page: file, guide, product, retailer, url: href, issue: issues.join("; ") });
    }
  }
}

const report = {
  ...summary,
  issues: rows
};

if (!existsSync("exports")) mkdirSync("exports");
writeFileSync(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`, "utf8");
const csvRows = rows.map((row) => [
  row.page,
  row.guide,
  row.product,
  row.retailer,
  row.issue,
  row.url
].map((value) => `"${String(value).replace(/"/g, "\"\"")}"`).join(","));
writeFileSync(
  OUTPUT_CSV,
  `${["page,guide,product,retailer,issue,url", ...csvRows].join("\n")}\n`,
  "utf8"
);

console.log(`Affiliate readiness checked ${summary.active_shopping_links} shopping links.`);
console.log(`Amazon product links ready: ${summary.amazon_product_links}.`);
console.log(`Amazon links needing exact product URLs: ${summary.amazon_links_needing_exact_product_url}.`);
console.log(`Non-Amazon retailer links treated as valid: ${summary.non_amazon_retail_links}.`);
console.log(`Report: ${OUTPUT_JSON}`);
