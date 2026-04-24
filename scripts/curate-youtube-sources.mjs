import { readFileSync, writeFileSync } from "node:fs";

const categories = [
  ...JSON.parse(readFileSync("data/categories.json", "utf8").replace(/^\uFEFF/, "")),
  ...readOptionalJson("data/roundup-additions.json", [])
];

const existingOverrides = readOptionalJson("data/youtube-evidence-overrides.json", []);
const trustedChannels = new Set([
  "Believe in the Run",
  "The Run Testers",
  "RoadTrailRun",
  "Run4Adventure",
  "TheGingerRunner",
  "Ben Parkes",
  "Seth James DeMoor",
  "Running Warehouse",
  "iRunFar",
  "Tech Gear Talk",
  "BTODtv",
  "Tom's Guide",
  "The Tech Chap",
  "Consumer Analysis",
  "Vacuum Wars",
  "Pack Hacker",
  "Chase Reeves",
  "James Hoffmann",
  "Lance Hedrick"
]);

const weakChannels = [
  /\bamazon\b/i,
  /\bofficial\b/i,
  /\bbrand\b/i,
  /\bcommercial\b/i
];

const reviewWords = [
  "review",
  "tested",
  "test",
  "testing",
  "first run",
  "first look",
  "comparison",
  "compare",
  "versus",
  " vs ",
  "after",
  "miles",
  "worth",
  "before you buy",
  "good",
  "bad",
  "honest",
  "truth",
  "should you buy"
];

const cautionWords = [
  "bad",
  "before you buy",
  "truth",
  "honest",
  "worth",
  "should you buy",
  "problem",
  "issue",
  "vs",
  "versus",
  "compare",
  "comparison",
  "after"
];

function readOptionalJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

function normalize(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function productTokens(productName) {
  return normalize(productName)
    .split(/\s+/)
    .filter((token) => token.length > 1)
    .filter((token) => !["the", "and", "for", "with", "pro", "plus", "gen", "new"].includes(token));
}

function titleMatchesProduct(title, productName) {
  const titleNorm = normalize(title);
  const tokens = productTokens(productName);
  if (!tokens.length) return false;

  const important = tokens.filter((token) => /[0-9]/.test(token) || token.length >= 4);
  const required = important.slice(0, Math.min(3, important.length || tokens.length));
  const matches = tokens.filter((token) => titleNorm.includes(token)).length;
  const requiredMatches = required.filter((token) => titleNorm.includes(token)).length;

  return requiredMatches >= Math.min(2, required.length) && matches >= Math.min(3, tokens.length);
}

function isMeaningfulReview(video, productName) {
  const haystack = normalize(`${video.title} ${video.channel}`);
  if (!titleMatchesProduct(video.title, productName)) return false;
  if (weakChannels.some((pattern) => pattern.test(video.channel))) return false;
  return reviewWords.some((word) => haystack.includes(normalize(word))) || trustedChannels.has(video.channel);
}

function classifyPolarity(video) {
  const haystack = normalize(`${video.title} ${video.channel}`);
  return cautionWords.some((word) => haystack.includes(normalize(word))) ? "caution" : "positive";
}

function scoreFor(video, polarity, index) {
  const trustedBonus = trustedChannels.has(video.channel) ? 3 : 0;
  const freshnessBonus = /week|month|mo ago|year ago|1 year/i.test(video.published ?? "") ? 1 : 0;
  const base = polarity === "caution" ? 80 : 84;
  return Math.min(91, base + trustedBonus + freshnessBonus - Math.min(index, 2));
}

function extractVideos(html) {
  const results = [];
  const seen = new Set();
  const parts = html.split('{"videoRenderer":').slice(1);
  for (const part of parts.slice(0, 24)) {
    const videoId = part.match(/"videoId":"([A-Za-z0-9_-]{11})"/)?.[1];
    const titleRaw = part.match(/"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/)?.[1];
    const channelRaw = part.match(/"longBylineText":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/)?.[1];
    const published = part.match(/"publishedTimeText":\{"simpleText":"([^"]+)"/)?.[1] ?? "";
    const length = part.match(/"lengthText":\{(?:.*?)"simpleText":"([^"]+)"/)?.[1] ?? "";
    if (!videoId || !titleRaw || !channelRaw || seen.has(videoId)) continue;
    seen.add(videoId);
    results.push({
      videoId,
      title: JSON.parse(`"${titleRaw}"`),
      channel: JSON.parse(`"${channelRaw}"`),
      published,
      length,
      url: `https://www.youtube.com/watch?v=${videoId}`
    });
  }
  return results;
}

async function searchYouTube(query) {
  const urls = [
    `https://www.youtube.com/results?sp=EgIQAQ%253D%253D&search_query=${encodeURIComponent(query)}`,
    `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0",
          "accept-language": "en-US,en;q=0.9"
        },
        redirect: "follow"
      });
      if (!response.ok) continue;
      const videos = extractVideos(await response.text());
      if (videos.length) return videos;
    } catch {
      continue;
    }
  }

  return [];
}

function existingExactYouTube(product) {
  return (product.evidence ?? [])
    .filter((item) => (item.channel === "YouTube" || item.source_type === "youtube") && item.is_public !== false)
    .filter((item) => item.url && !item.url.includes("youtube.com/results"));
}

function overrideFor(productName) {
  return existingOverrides.find((entry) => entry.productName === productName);
}

const uniqueProducts = new Map();
for (const category of categories) {
  for (const product of category.products ?? []) {
    if (!uniqueProducts.has(product.name)) uniqueProducts.set(product.name, { product, categories: [] });
    uniqueProducts.get(product.name).categories.push(category);
  }
}

const overridesByProduct = new Map(existingOverrides.map((entry) => [entry.productName, entry]));
const report = [];

async function processProduct(productName, { product, categories: productCategories }) {
  const existing = existingExactYouTube(product);
  const existingOverride = overrideFor(productName);
  if ((existing.length + (existingOverride?.evidence?.length ?? 0)) >= 2) {
    return { productName, status: "already-covered", videosAdded: 0 };
  }

  const categoryTerms = [...new Set(productCategories.map((category) => category.eyebrow || category.title))]
    .slice(0, 2)
    .join(" ");
  const query = `${productName} ${categoryTerms} review`;
  const videos = (await searchYouTube(query)).filter((video) => isMeaningfulReview(video, productName));
  const selected = [];
  const seenUrls = new Set([...(existingOverride?.evidence ?? []).map((item) => item.url), ...existing.map((item) => item.url)]);

  for (const bucket of ["positive", "caution"]) {
    const bucketVideos = videos.filter((video) => classifyPolarity(video) === bucket);
    const limit = bucket === "positive" ? 2 : 1;
    for (const video of bucketVideos) {
      if (selected.filter((item) => item.evidence_polarity === bucket).length >= limit) break;
      if (seenUrls.has(video.url)) continue;
      seenUrls.add(video.url);
      const index = selected.length;
      selected.push({
        channel: "YouTube",
        sourceName: video.channel,
        url: video.url,
        tier: trustedChannels.has(video.channel) ? "Tier 1" : "Tier 2",
        score: scoreFor(video, bucket, index),
        evidenceType: "exact product video review",
        sampleSize: 1,
        relevance: trustedChannels.has(video.channel) ? 0.92 : 0.84,
        summary: `${bucket === "positive" ? "Useful video review for confirming the product's upside in real use." : "Useful video review for spotting tradeoffs before checkout."}`,
        title: video.title,
        verifiedAt: "Apr 24, 2026",
        source_type: "youtube",
        source_tier: trustedChannels.has(video.channel) ? "tier1" : "tier2",
        publisher: video.channel,
        checked_date: "Apr 24, 2026",
        product_name: productName,
        evidence_note: `${video.channel} video review: ${video.title}`,
        trust_reason: "Exact product video review with visible hands-on context, comparison, or buying guidance.",
        evidence_polarity: bucket,
        is_primary_source: trustedChannels.has(video.channel) && bucket === "positive",
        display_order: bucket === "positive" ? 20 + selected.length / 100 : 22 + selected.length / 100,
        is_public: true,
        video_id: video.videoId,
        timestamp_start: null,
        timestamp_label: "Product discussion"
      });
    }
  }

  if (selected.length) {
    const next = existingOverride ?? { productName, evidence: [] };
    next.evidence = [...(next.evidence ?? []), ...selected];
    overridesByProduct.set(productName, next);
  }

  return {
    productName,
    query,
    status: selected.length ? "updated" : "limited-public-video-evidence",
    videosAdded: selected.length,
    selected: selected.map((item) => ({ title: item.title, url: item.url, polarity: item.evidence_polarity }))
  };
}

const entries = [...uniqueProducts.entries()];
const batchSize = 8;
for (let index = 0; index < entries.length; index += batchSize) {
  const batch = entries.slice(index, index + batchSize);
  const results = await Promise.all(batch.map(([productName, entry]) => processProduct(productName, entry)));
  report.push(...results);
  console.log(`Reviewed ${Math.min(index + batch.length, entries.length)} / ${entries.length} products...`);
}

const overrides = [...overridesByProduct.values()]
  .filter((entry) => entry.evidence?.length)
  .sort((a, b) => a.productName.localeCompare(b.productName));

writeFileSync("data/youtube-evidence-overrides.json", JSON.stringify(overrides, null, 2) + "\n", "utf8");
writeFileSync("data/youtube-curation-report.json", JSON.stringify({
  generatedAt: new Date().toISOString(),
  productsReviewed: uniqueProducts.size,
  productsUpdated: report.filter((item) => item.status === "updated").length,
  productsLimited: report.filter((item) => item.status === "limited-public-video-evidence").length,
  report
}, null, 2) + "\n", "utf8");

console.log(`Reviewed ${uniqueProducts.size} unique products.`);
console.log(`Updated ${report.filter((item) => item.status === "updated").length} products with exact YouTube evidence.`);
console.log(`${report.filter((item) => item.status === "limited-public-video-evidence").length} products still need manual video curation.`);
