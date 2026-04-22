import { readFileSync, writeFileSync } from "node:fs";

const CATEGORIES_PATH = "data/categories.json";
const REPORT_PATH = "data/reddit-source-curation.json";
const CHECKED_DATE = "Apr 22, 2026";
const USER_AGENT = "PhavaiSourceCurator/1.0 (+https://www.phavai.com)";
const MAX_REDDIT_PER_POLARITY = 3;
const MAX_SEARCH_RESULTS = 14;
const REQUEST_DELAY_MS = 375;
const AUTO_CURATED_TRUST_REASON = "Owner discussion used to catch fit, durability, setup, value, and long-term tradeoffs.";

const categories = JSON.parse(readFileSync(CATEGORIES_PATH, "utf8").replace(/^\uFEFF/, ""));

const SKIP_SUBREDDITS = new Set([
  "therunningrack",
  "geartrade",
  "ulgeartrade",
  "hardwareswap",
  "appleswap",
  "coffeeswap"
]);

const BRAND_TOKENS = new Set([
  "amazon",
  "anker",
  "asics",
  "away",
  "beats",
  "birkenstock",
  "black",
  "blueair",
  "branch",
  "breville",
  "briggs",
  "brooks",
  "camelbak",
  "coros",
  "coway",
  "ekrin",
  "ergotron",
  "flexispot",
  "fully",
  "garmin",
  "gossamer",
  "grovemade",
  "haworth",
  "herman",
  "hoka",
  "hyperice",
  "inov",
  "jabra",
  "kane",
  "keychron",
  "kinesis",
  "knodel",
  "la",
  "leki",
  "levoit",
  "logitech",
  "monos",
  "nathan",
  "new",
  "nike",
  "ninja",
  "obsbot",
  "oofos",
  "orbitkey",
  "osprey",
  "oxo",
  "patagonia",
  "polar",
  "razer",
  "salomon",
  "saucony",
  "shokz",
  "steelcase",
  "technivorm",
  "therabody",
  "theragun",
  "the",
  "topo",
  "travelpro",
  "ultimate",
  "uplift",
  "vari",
  "winix",
  "zsa"
]);

const GENERIC_TOKENS = new Set([
  "active",
  "air",
  "arm",
  "basics",
  "better",
  "blue",
  "bottle",
  "carbon",
  "chair",
  "coffee",
  "desk",
  "distance",
  "duo",
  "electric",
  "ergonomic",
  "fresh",
  "gear",
  "gen",
  "large",
  "max",
  "men",
  "mighty",
  "monitor",
  "office",
  "open",
  "premium",
  "pro",
  "pure",
  "recovery",
  "running",
  "series",
  "shoe",
  "shoes",
  "slide",
  "stand",
  "standing",
  "trail",
  "ultra",
  "vest",
  "women",
  "x"
]);

const POSITIVE_WORDS = [
  "review",
  "first impression",
  "first impressions",
  "love",
  "loved",
  "awesome",
  "excellent",
  "phenomenal",
  "great",
  "worth",
  "recommend",
  "favorite",
  "long term",
  "long-term",
  "miles",
  "later",
  "thoughts"
];

const CAUTION_WORDS = [
  "advice",
  "advise",
  "avoid",
  "bad",
  "broken",
  "caution",
  "complaint",
  "concern",
  "defect",
  "disappointed",
  "durability",
  "fail",
  "fit",
  "help",
  "hot",
  "issue",
  "narrow",
  "pain",
  "problem",
  "question",
  "sizing",
  "sweat",
  "sweaty",
  "warranty",
  "wet",
  "wide"
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalize(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/&amp;/g, " and ")
    .replace(/[/+._-]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function decodeHtml(value = "") {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function tokensFor(value = "") {
  return normalize(value).split(" ").filter(Boolean);
}

function meaningfulTokens(name) {
  const tokens = tokensFor(name);
  const filtered = tokens.filter((token) => {
    if (token.length <= 1 && !/\d/.test(token)) return false;
    if (BRAND_TOKENS.has(token)) return false;
    if (GENERIC_TOKENS.has(token) && !/\d/.test(token)) return false;
    return true;
  });

  return filtered.length ? filtered : tokens.filter((token) => token.length > 2 || /\d/.test(token));
}

function brandTokensFor(name) {
  return tokensFor(name).filter((token) => BRAND_TOKENS.has(token));
}

function urlKey(url = "") {
  return String(url).split("#")[0].split("?")[0].replace(/\/$/, "").toLowerCase();
}

function productMatchesPost(productName, post) {
  const haystack = normalize(`${post.title ?? ""} ${post.selftext ?? ""}`);
  const exact = normalize(productName);
  if (haystack.includes(exact)) return true;

  const meaningful = meaningfulTokens(productName);
  if (!meaningful.length) return false;

  const matched = meaningful.filter((token) => haystack.includes(token));
  const coverage = matched.length / meaningful.length;
  const brands = brandTokensFor(productName);
  const hasBrandContext = !brands.length || brands.some((token) => haystack.includes(token));

  if (meaningful.length <= 2 && !hasBrandContext) return false;
  if (meaningful.length <= 2) return coverage === 1;
  return coverage >= 0.72;
}

function classifyPolarity(post) {
  const haystack = normalize(`${post.title ?? ""} ${post.selftext ?? ""}`);
  const cautionHits = CAUTION_WORDS.filter((word) => haystack.includes(word)).length;
  const positiveHits = POSITIVE_WORDS.filter((word) => haystack.includes(word)).length;

  if (cautionHits > positiveHits) return "caution";
  if (positiveHits > 0) return "positive";
  return "positive";
}

function evidenceScoreFor(polarity, post) {
  const comments = post.num_comments ?? 0;
  const base = polarity === "caution" ? 77 : 84;
  const commentBonus = Math.min(3, Math.log10(comments + 1) * 1.4);
  return Math.round(base + commentBonus);
}

function evidenceNoteFor(productName, polarity, post) {
  const subreddit = post.subreddit ? `r/${post.subreddit}` : "Reddit";
  if (polarity === "caution") {
    return `${subreddit} thread adds owner cautions around ${productName}: ${post.title}.`;
  }
  return `${subreddit} thread adds owner feedback around ${productName}: ${post.title}.`;
}

function redditEvidenceFromPost(productName, categoryTitle, post, index) {
  const polarity = classifyPolarity(post);
  const permalink = post.permalink?.startsWith("http")
    ? post.permalink
    : `https://www.reddit.com${post.permalink ?? ""}`;
  const publishedAt = post.created_utc
    ? new Date(post.created_utc * 1000).toISOString().slice(0, 10)
    : "";
  const note = evidenceNoteFor(productName, polarity, post);

  return {
    channel: "Reddit",
    sourceName: `r/${post.subreddit} thread`,
    url: permalink,
    tier: "Tier 3",
    score: evidenceScoreFor(polarity, post),
    publishedAt,
    evidenceType: "specific community thread",
    sampleSize: Math.max(1, (post.num_comments ?? 0) + 1),
    relevance: 0.66,
    summary: decodeHtml(note),
    title: decodeHtml(post.title),
    verifiedAt: CHECKED_DATE,
    source_type: "reddit",
    source_tier: "tier3",
    publisher: `r/${post.subreddit} thread`,
    author: post.author && post.author !== "[deleted]" ? post.author : "",
    publish_date: publishedAt,
    checked_date: CHECKED_DATE,
    product_name: productName,
    page_use_case: categoryTitle,
    evidence_note: decodeHtml(note),
    trust_reason: AUTO_CURATED_TRUST_REASON,
    evidence_polarity: polarity,
    is_primary_source: false,
    display_order: 30.2 + index / 100,
    is_public: true,
    is_exact_url: true,
    subreddit: post.subreddit,
    thread_type: "post",
    permalink_type: "exact_thread",
    discussion_quality: (post.num_comments ?? 0) >= 20 ? "high" : (post.num_comments ?? 0) >= 6 ? "medium" : "low"
  };
}

function searchVariants(productName) {
  const variants = new Set([productName]);
  const noSlash = productName.replace(/\//g, " ");
  variants.add(noSlash);
  variants.add(productName.replace(/(\d)\.0\b/g, "$1"));
  variants.add(productName.replace(/^Therabody\s+/i, ""));
  variants.add(productName.replace(/^The North Face\s+/i, "TNF "));
  variants.add(productName.replace(/^Inov-?8\s+/i, "Inov8 "));

  const slashMatch = productName.match(/^(.+?)\s+([A-Za-z0-9-]+)\/([A-Za-z0-9-]+)\s+(.+)$/);
  if (slashMatch) {
    variants.add(`${slashMatch[1]} ${slashMatch[2]} ${slashMatch[4]}`);
    variants.add(`${slashMatch[1]} ${slashMatch[3]} ${slashMatch[4]}`);
  }

  return [...variants]
    .map((variant) => variant.trim().replace(/\s+/g, " "))
    .filter(Boolean);
}

async function redditSearchQuery(productName, queryText) {
  const query = `"${queryText}"`;
  const url = new URL("https://www.reddit.com/search.json");
  url.searchParams.set("q", query);
  url.searchParams.set("sort", "relevance");
  url.searchParams.set("t", "all");
  url.searchParams.set("limit", String(MAX_SEARCH_RESULTS));
  url.searchParams.set("type", "link");

  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT }
  });

  if (!response.ok) {
    throw new Error(`Reddit search failed for ${productName}: ${response.status}`);
  }

  const json = await response.json();
  return (json.data?.children ?? [])
    .map((child) => child.data)
    .filter((post) => post?.permalink && post?.title)
    .filter((post) => !post.over_18)
    .filter((post) => !SKIP_SUBREDDITS.has(String(post.subreddit ?? "").toLowerCase()))
    .filter((post) => productMatchesPost(productName, post) || productMatchesPost(queryText, post));
}

async function redditSearch(productName) {
  const posts = [];
  const urls = new Set();

  for (const variant of searchVariants(productName)) {
    if (posts.length >= MAX_REDDIT_PER_POLARITY * 2) break;
    const results = await redditSearchQuery(productName, variant);
    for (const post of results) {
      const permalink = post.permalink?.startsWith("http")
        ? post.permalink
        : `https://www.reddit.com${post.permalink ?? ""}`;
      const key = urlKey(permalink);
      if (urls.has(key)) continue;
      posts.push(post);
      urls.add(key);
    }
    await sleep(125);
  }

  return posts.slice(0, MAX_SEARCH_RESULTS);
}

function countPolarity(items, polarity) {
  return items.filter((item) => (item.evidence_polarity ?? "").toLowerCase() === polarity).length;
}

function addRedditEvidence(product, category, candidates) {
  product.evidence = product.evidence ?? [];
  product.evidence = product.evidence.filter((item) => item.trust_reason !== AUTO_CURATED_TRUST_REASON);
  for (const item of product.evidence) {
    if (!(item.channel === "Reddit" || item.source_type === "reddit")) continue;
    if (/reddit\.com\/search/i.test(item.url ?? "")) {
      item.is_public = false;
      item.is_generic_discovery = true;
      item.evidence_polarity = item.evidence_polarity ?? "caution";
    }
  }
  const existingReddit = product.evidence.filter((item) => item.channel === "Reddit" || item.source_type === "reddit");
  const existingUrls = new Set(existingReddit.map((item) => urlKey(item.url)));
  let positiveCount = countPolarity(existingReddit, "positive");
  let cautionCount = countPolarity(existingReddit, "caution");
  let added = 0;

  for (const post of candidates) {
    const permalink = post.permalink?.startsWith("http")
      ? post.permalink
      : `https://www.reddit.com${post.permalink ?? ""}`;
    const key = urlKey(permalink);
    if (existingUrls.has(key)) continue;

    const polarity = classifyPolarity(post);
    if (polarity === "positive" && positiveCount >= MAX_REDDIT_PER_POLARITY) continue;
    if (polarity === "caution" && cautionCount >= MAX_REDDIT_PER_POLARITY) continue;

    product.evidence.push(redditEvidenceFromPost(product.name, category.title, post, existingReddit.length + added));
    existingUrls.add(key);
    if (polarity === "positive") positiveCount += 1;
    if (polarity === "caution") cautionCount += 1;
    added += 1;
  }

  return {
    added,
    positive: positiveCount,
    caution: cautionCount,
    total: product.evidence.filter((item) => item.channel === "Reddit" || item.source_type === "reddit").length
  };
}

const productsByName = new Map();
for (const category of categories) {
  for (const product of category.products ?? []) {
    if (!productsByName.has(product.name)) productsByName.set(product.name, []);
    productsByName.get(product.name).push({ product, category });
  }
}

const report = {
  checked_date: CHECKED_DATE,
  products: []
};

for (const [productName, entries] of productsByName) {
  let posts = [];
  let error = "";

  try {
    posts = await redditSearch(productName);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  for (const { product, category } of entries) {
    const stats = addRedditEvidence(product, category, posts);
    report.products.push({
      product_name: product.name,
      page: category.slug,
      exact_posts_found: posts.length,
      added: stats.added,
      reddit_total_after: stats.total,
      positive_after: stats.positive,
      caution_after: stats.caution,
      error
    });
  }

  console.log(`${productName}: ${posts.length} exact Reddit posts found`);
  await sleep(REQUEST_DELAY_MS);
}

writeFileSync(CATEGORIES_PATH, JSON.stringify(categories, null, 2) + "\n");
writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n");

const pagesUpdated = report.products.filter((row) => row.added > 0).length;
const linksAdded = report.products.reduce((sum, row) => sum + row.added, 0);
console.log(`Added ${linksAdded} Reddit sources across ${pagesUpdated} product placements.`);
