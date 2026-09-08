import { readFileSync, writeFileSync } from "node:fs";

const categories = [
  ...JSON.parse(readFileSync("data/categories.json", "utf8").replace(/^\uFEFF/, "")),
  ...readOptionalJson("data/roundup-additions.json", []),
  ...readOptionalJson("data/revenue-roundups.json", [])
];
const evidenceOverrides = readOptionalJson("data/youtube-evidence-overrides.json", []);

function readOptionalJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

function sourceType(item = {}) {
  const url = item.url ?? "";
  const name = `${item.sourceName ?? ""} ${item.evidenceType ?? ""}`.toLowerCase();
  if (item.source_type) return item.source_type;
  if (item.channel === "YouTube" || /youtu\.?be|youtube\.com/i.test(url)) return "youtube";
  if (item.channel === "Reddit" || /reddit\.com/i.test(url)) return "reddit";
  if (name.includes("retailer")) return "retailer";
  if (name.includes("brand")) return "brand";
  if (name.includes("spec")) return "specs";
  return "expert";
}

function channelOf(item) {
  const type = sourceType(item);
  if (type === "youtube") return "YouTube";
  if (type === "reddit") return "Reddit";
  if (type === "expert") return "Expert";
  return null;
}

function youtubeId(url = "") {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return parsed.pathname.split("/").filter(Boolean)[0] ?? "";
    if (parsed.hostname.includes("youtube.com")) return parsed.searchParams.get("v") ?? "";
  } catch {
    return "";
  }
  return "";
}

function exactUrl(item = {}) {
  const url = item.url ?? "";
  const type = sourceType(item);
  if (!/^https?:\/\//i.test(url)) return false;
  if (/youtube\.com\/results|reddit\.com\/search/i.test(url)) return false;
  if (/youtube\.com\/(channel|@|c\/|user\/)/i.test(url)) return false;
  if (type === "youtube") return Boolean(youtubeId(url));
  if (type === "reddit") return /reddit\.com\/r\/[^/]+\/comments\//i.test(url);
  return true;
}

const PRODUCT_TOKEN_STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "men",
  "mens",
  "women",
  "womens",
  "shoe",
  "shoes",
  "running",
  "trail",
  "best",
  "review",
  "reviews",
  "updated",
  "new"
]);

function productSourceTokens(product = {}) {
  return String(product.name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !PRODUCT_TOKEN_STOPWORDS.has(token));
}

function sourceQualityFlags(item = {}, product = {}) {
  const type = sourceType(item);
  const url = item.url ?? "";
  const isExact = exactUrl(item);
  const text = `${item.title ?? ""} ${item.sourceName ?? ""} ${item.publisher ?? ""} ${item.summary ?? ""} ${item.evidence_note ?? ""} ${url}`.toLowerCase();
  const flags = [];
  const productTokens = productSourceTokens(product);
  const productMentioned = productTokens.length === 0 || productTokens.some((token) => text.includes(token));

  if (!isExact) flags.push("generic_or_non_exact_url");
  if (/amazon\.com|amzn\.to|ebay\.com|walmart\.com|target\.com|bestbuy\.com/i.test(url) || type === "retailer") flags.push("for_sale_listing");
  if (type === "youtube" && !youtubeId(url)) flags.push("generic_youtube_link");
  if (type === "reddit" && !/reddit\.com\/r\/[^/]+\/comments\//i.test(url)) flags.push("generic_reddit_link");
  if (type === "reddit" && (item.discussion_quality === "low" || ((item.sampleSize ?? 0) > 0 && (item.sampleSize ?? 0) < 3))) flags.push("weak_owner_discussion");
  if (type === "youtube" && /shorts|unboxing|first look|commercial|promo|ad\b|sale|deal/i.test(text) && !/review|test|tested|comparison|after|miles|long term|long-term/i.test(text)) flags.push("weak_video_context");
  if (/setup question|sizing question|quick question|deal alert|coupon|sale price|where to buy/i.test(text) && !/review|tested|owner|experience|miles|long term|long-term/i.test(text)) flags.push("low_decision_value");
  if (!productMentioned && ["youtube", "reddit"].includes(type)) flags.push("product_relevance_unclear");
  if (typeof item.relevance === "number" && item.relevance < 0.55) flags.push("low_relevance_score");

  return flags;
}

function isPublicEvidence(item = {}, product = {}) {
  return item.is_public !== false &&
    exactUrl(item) &&
    !/corpus|sentiment sample|discovery/i.test(`${item.sourceName ?? ""} ${item.evidenceType ?? ""}`) &&
    sourceQualityFlags(item, product).length === 0;
}

function polarityOf(item) {
  if (item.evidence_polarity === "caution") return "caution";
  if (item.evidence_polarity === "positive" || item.evidence_polarity === "mixed") return "positive";
  return Number(item.score) <= 83 ? "caution" : "positive";
}

function countBy(items, predicate) {
  return items.filter(predicate).length;
}

function sourceKey(item) {
  return String(item.url || item.title || item.sourceName || "").trim().toLowerCase();
}

function mergeEvidence(product, category) {
  const matchingOverrides = evidenceOverrides
    .filter((entry) => {
      const productMatches = entry.productName?.toLowerCase() === product.name.toLowerCase();
      const categoryMatches = !entry.categorySlug || entry.categorySlug === category.slug;
      return productMatches && categoryMatches;
    })
    .flatMap((entry) => entry.evidence ?? []);

  const merged = [];
  const seen = new Set();
  for (const item of [...(product.evidence ?? []), ...matchingOverrides]) {
    const key = sourceKey(item);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    merged.push(item);
  }
  return merged;
}

const productReports = [];

for (const category of categories) {
  for (const product of category.products ?? []) {
    const publicEvidence = mergeEvidence(product, category).filter((item) => isPublicEvidence(item, product));
    const channels = {};

    for (const channel of ["Expert", "YouTube", "Reddit"]) {
      const evidence = publicEvidence.filter((item) => channelOf(item) === channel);
      channels[channel] = {
        total: evidence.length,
        positive: countBy(evidence, (item) => polarityOf(item) === "positive"),
        caution: countBy(evidence, (item) => polarityOf(item) === "caution"),
        exactUrls: countBy(evidence, (item) => Boolean(item.url) && !/search|corpus|sentiment/i.test(`${item.url} ${item.sourceName ?? ""}`))
      };
    }

    const missingChannels = Object.entries(channels)
      .filter(([, value]) => value.total === 0)
      .map(([channel]) => channel);
    const thinChannels = Object.entries(channels)
      .filter(([, value]) => value.total > 0 && value.total < 2)
      .map(([channel]) => channel);

    productReports.push({
      page: category.slug,
      title: category.title,
      product: product.name,
      channels,
      missingChannels,
      thinChannels,
      recommendation: missingChannels.length || thinChannels.length
        ? "Needs more source curation before this product is considered source-complete."
        : "Good public source coverage."
    });
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  pages: categories.length,
  products: productReports.length,
  productsMissingYouTube: productReports.filter((item) => item.channels.YouTube.total === 0).length,
  productsWithAtLeastTwoYouTubeSources: productReports.filter((item) => item.channels.YouTube.total >= 2).length,
  productsMissingReddit: productReports.filter((item) => item.channels.Reddit.total === 0).length,
  productsWithAtLeastTwoRedditSources: productReports.filter((item) => item.channels.Reddit.total >= 2).length,
  productsMissingExpert: productReports.filter((item) => item.channels.Expert.total === 0).length
};

writeFileSync("data/source-coverage-report.json", JSON.stringify({ summary, products: productReports }, null, 2) + "\n", "utf8");
console.log(`Wrote source coverage for ${summary.products} products across ${summary.pages} pages.`);
console.log(`${summary.productsMissingYouTube} products have no YouTube evidence; ${summary.productsWithAtLeastTwoYouTubeSources} have 2+ YouTube sources.`);
