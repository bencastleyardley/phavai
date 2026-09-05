import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const SITE_ROOT = process.cwd();
const REPORT_PATH = "data/quality-governance-report.json";
const commercialConfig = readJson("data/commercial-config.json", {});
const AFFILIATE_ENABLED = configuredBool(commercialConfig.affiliateEnabled === true, "PHAVAI_AFFILIATE_ENABLED", "AFFILIATE_ENABLED", "AMAZON_AFFILIATE_ENABLED");

function readJson(file, fallback = []) {
  try {
    return JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

function firstEnv(...names) {
  return names.map((name) => process.env[name]).find((value) => value && value.trim())?.trim() ?? "";
}

function boolEnv(...names) {
  return parseBoolValue(firstEnv(...names));
}

function parseBoolValue(value = "") {
  return ["1", "true", "yes", "on", "enabled"].includes(String(value).toLowerCase());
}

function configuredBool(defaultValue, ...names) {
  const value = firstEnv(...names);
  return value ? parseBoolValue(value) : Boolean(defaultValue);
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

function evidencePolarity(item = {}) {
  const text = `${item.title ?? ""} ${item.summary ?? ""} ${item.evidence_note ?? ""} ${item.evidenceType ?? ""}`.toLowerCase();
  if (item.evidence_polarity) return item.evidence_polarity;
  if ((item.score ?? 82) <= 78) return "caution";
  if (/caution|complaint|drawback|issue|problem|narrow|tight|firm|sloppy|unstable|durability|sizing|disappointed/.test(text)) return "caution";
  return "positive";
}

function sourceDecisionQuality(item = {}, product = {}) {
  const type = sourceType(item);
  const flags = sourceQualityFlags(item, product);
  const isExact = exactUrl(item);

  if (type === "retailer" || /amazon\.com|amzn\.to|walmart\.com|target\.com|bestbuy\.com/i.test(item.url ?? "")) return "commercial/affiliate source";
  if (["brand", "specs"].includes(type)) return "specs only";
  if (!isExact || flags.some((flag) => ["generic_or_non_exact_url", "generic_youtube_link", "generic_reddit_link"].includes(flag))) return "weak mention";
  if (flags.some((flag) => ["product_relevance_unclear", "low_relevance_score", "low_decision_value"].includes(flag))) return "irrelevant";
  if (flags.length) return "weak mention";
  if (evidencePolarity(item) === "caution") return "useful caution evidence";
  return "strong decision evidence";
}

function isPublicEvidence(item = {}, product = {}) {
  return item.is_public !== false &&
    exactUrl(item) &&
    !/corpus|sentiment sample|discovery/i.test(`${item.sourceName ?? ""} ${item.evidenceType ?? ""}`) &&
    sourceQualityFlags(item, product).length === 0;
}

function stripVisibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlFiles() {
  return readdirSync(SITE_ROOT)
    .filter((file) => file.endsWith(".html"))
    .sort();
}

function internalLinks(html) {
  return Array.from(html.matchAll(/\shref="([^"]+)"/g))
    .map((match) => match[1])
    .filter((href) => href.startsWith("/") && !href.startsWith("//"))
    .filter((href) => !href.startsWith("/#"));
}

function targetExists(href) {
  const pathname = href.split("#")[0].split("?")[0];
  if (pathname === "/" || pathname === "/index.html") return existsSync("index.html");
  return existsSync(path.join(SITE_ROOT, pathname.replace(/^\//, "")));
}

function parseChannelScores(html) {
  const products = [];
  const articleRegex = /<article class="product"[^>]*data-product-name="([^"]+)"[^>]*data-editorial-rank="([^"]+)"[^>]*data-channel-scores='([^']+)'/g;
  for (const match of html.matchAll(articleRegex)) {
    try {
      products.push({
        productName: match[1].replace(/&amp;/g, "&"),
        rank: Number(match[2]),
        scores: JSON.parse(match[3].replace(/&quot;/g, "\""))
      });
    } catch {
      products.push({ productName: match[1], rank: Number(match[2]), scores: {} });
    }
  }
  return products;
}

function parseProductCards(html) {
  const products = [];
  const articleRegex = /<article class="product"[^>]*data-product-name="([^"]+)"[^>]*data-default-score="([^"]+)"[^>]*data-editorial-rank="([^"]+)"/g;
  for (const match of html.matchAll(articleRegex)) {
    products.push({
      productName: match[1].replace(/&amp;/g, "&"),
      score: Number(match[2]),
      rank: Number(match[3])
    });
  }
  return products;
}

const categories = [
  ...readJson("data/categories.json"),
  ...readJson("data/roundup-additions.json"),
  ...readJson("data/revenue-roundups.json")
];
const evidenceOverrides = readJson("data/youtube-evidence-overrides.json");

function evidenceOverridesFor(product, category) {
  return evidenceOverrides
    .filter((entry) => {
      const productMatches = entry.productName?.toLowerCase() === product.name.toLowerCase();
      const categoryMatches = !entry.categorySlug || entry.categorySlug === category.slug;
      return productMatches && categoryMatches;
    })
    .flatMap((entry) => entry.evidence ?? []);
}

const productEvidenceByPage = new Map();
const sourcePriorityByPage = new Map();
const report = {
  generated_at: new Date().toISOString(),
  affiliate_enabled: AFFILIATE_ENABLED,
  pages_checked: 0,
  products_checked: 0,
  hard_failures: [],
  products_missing_expert_sources: [],
  products_with_fewer_than_two_expert_sources: [],
  products_missing_youtube_evidence: [],
  products_missing_reddit_evidence: [],
  products_with_weak_or_generic_links: [],
  public_sources_demoted: [],
  source_quality_classifications: {
    "strong decision evidence": 0,
    "useful caution evidence": 0,
    "weak mention": 0,
    irrelevant: 0,
    "specs only": 0,
    "duplicate evidence": 0,
    "commercial/affiliate source": 0
  },
  products_with_scores_hidden_due_to_weak_evidence: [],
  source_priority_focus: [],
  products_with_thin_evidence: [],
  scoring_evidence_mismatches: [],
  ranking_copy_contradictions: [],
  ranking_order_warnings: [],
  source_drawer_warnings: [],
  structured_data_warnings: [],
  model_freshness_flags: [],
  cut_off_sentence_warnings: [],
  duplicate_section_warnings: [],
  repeated_or_awkward_copy: [],
  broken_internal_links: []
};

for (const category of categories) {
  for (const product of category.products ?? []) {
    const evidence = [...(product.evidence ?? []), ...evidenceOverridesFor(product, category)];
    const seenSourceUrls = new Set();
    for (const item of evidence) {
      const urlKey = String(item.url ?? "").split("#")[0].split("?si=")[0].trim().toLowerCase().replace(/\/$/, "");
      const classification = urlKey && seenSourceUrls.has(urlKey)
        ? "duplicate evidence"
        : sourceDecisionQuality(item, product);
      if (urlKey) seenSourceUrls.add(urlKey);
      report.source_quality_classifications[classification] = (report.source_quality_classifications[classification] ?? 0) + 1;
    }
    const publicEvidence = evidence.filter((item) => isPublicEvidence(item, product));
    const experts = publicEvidence.filter((item) => sourceType(item) === "expert");
    const youtube = publicEvidence.filter((item) => sourceType(item) === "youtube");
    const reddit = publicEvidence.filter((item) => sourceType(item) === "reddit");
    const allYouTube = evidence.filter((item) => sourceType(item) === "youtube");
    const allReddit = evidence.filter((item) => sourceType(item) === "reddit");
    const allExperts = evidence.filter((item) => sourceType(item) === "expert");
    const weakLinks = evidence
      .map((item) => ({ item, flags: sourceQualityFlags(item, product) }))
      .filter(({ item, flags }) => item.url && flags.length);
    const hasLike = Boolean((product.positiveThemes ?? product.pros ?? []).length);
    const hasCaution = Boolean((product.cautionThemes ?? product.cons ?? []).length);
    const key = `${category.slug}::${product.name}`;
    const missingChannels = [];
    if (!experts.length) missingChannels.push("expert");
    if (experts.length < 2) missingChannels.push("second expert");
    if (!youtube.length) missingChannels.push("youtube");
    if (!reddit.length) missingChannels.push("reddit");

    productEvidenceByPage.set(key, {
      experts,
      youtube,
      reddit,
      total: publicEvidence.length,
      qualityScore: experts.length * 2 + youtube.length + reddit.length
    });
    report.products_checked += 1;
    if (missingChannels.length) {
      const pageFocus = sourcePriorityByPage.get(category.slug) ?? {
        page: category.slug,
        title: category.title,
        priority_score: 0,
        products_to_improve: 0,
        missing_expert_sources: 0,
        missing_second_expert_sources: 0,
        missing_youtube_evidence: 0,
        missing_reddit_evidence: 0,
        first_products: []
      };
      pageFocus.priority_score +=
        (!experts.length ? 5 : 0) +
        (experts.length < 2 ? 2 : 0) +
        (!youtube.length ? 2 : 0) +
        (!reddit.length ? 1 : 0);
      pageFocus.products_to_improve += 1;
      if (!experts.length) pageFocus.missing_expert_sources += 1;
      if (experts.length < 2) pageFocus.missing_second_expert_sources += 1;
      if (!youtube.length) pageFocus.missing_youtube_evidence += 1;
      if (!reddit.length) pageFocus.missing_reddit_evidence += 1;
      if (pageFocus.first_products.length < 4) {
        pageFocus.first_products.push({ product: product.name, missing_channels: missingChannels });
      }
      sourcePriorityByPage.set(category.slug, pageFocus);
    }

    if (!experts.length) report.products_missing_expert_sources.push({ page: category.slug, product: product.name });
    if (experts.length < 2) report.products_with_fewer_than_two_expert_sources.push({ page: category.slug, product: product.name, expert_count: experts.length });
    if (!youtube.length) report.products_missing_youtube_evidence.push({ page: category.slug, product: product.name });
    if (!reddit.length) report.products_missing_reddit_evidence.push({ page: category.slug, product: product.name });
    if (allExperts.length && !experts.length) report.products_with_scores_hidden_due_to_weak_evidence.push({ page: category.slug, product: product.name, channel: "Expert" });
    if (allYouTube.length && !youtube.length) report.products_with_scores_hidden_due_to_weak_evidence.push({ page: category.slug, product: product.name, channel: "YouTube" });
    if (allReddit.length && !reddit.length) report.products_with_scores_hidden_due_to_weak_evidence.push({ page: category.slug, product: product.name, channel: "Reddit" });
    if (weakLinks.length) {
      report.products_with_weak_or_generic_links.push({
        page: category.slug,
        product: product.name,
        links: weakLinks.slice(0, 5).map(({ item, flags }) => ({
          title: item.title ?? item.sourceName ?? "",
          url: item.url ?? "",
          channel: item.channel ?? sourceType(item),
          flags
        }))
      });
      report.public_sources_demoted.push({
        page: category.slug,
        product: product.name,
        count: weakLinks.length,
        reasons: Array.from(new Set(weakLinks.flatMap(({ flags }) => flags))).sort()
      });
    }
    if (!experts.length || publicEvidence.length < 3 || !hasLike || !hasCaution) {
      report.products_with_thin_evidence.push({
        page: category.slug,
        product: product.name,
        public_evidence_count: publicEvidence.length,
        expert_count: experts.length,
        has_like_interpretation: hasLike,
        has_caution_interpretation: hasCaution
      });
    }

    const text = `${product.tag ?? ""} ${product.verdict ?? ""} ${product.bestFor ?? ""} ${product.avoidIf ?? ""}`.toLowerCase();
    const tag = (product.tag ?? "").toLowerCase();
    const isClearlyScopedOverall = /by lab testing|for wide feet|for beginners|for muddy conditions|for technical trails/.test(tag);
    if (tag.includes("best overall") && !isClearlyScopedOverall && /niche|specialized|narrow|race-only|only for|avoid if/.test(text)) {
      report.ranking_copy_contradictions.push({ page: category.slug, product: product.name, issue: "Best Overall language may conflict with narrow/tradeoff wording." });
    }

    const modelFreshnessText = `${product.name} ${product.tag ?? ""} ${product.verdict ?? ""} ${(product.evidence ?? []).map((item) => `${item.title ?? ""} ${item.summary ?? ""}`).join(" ")}`.toLowerCase();
    if (/older model|previous model|discontinued|replaced by|last year'?s model/.test(modelFreshnessText) && !/newer model|current model|latest model|model freshness/i.test(modelFreshnessText)) {
      report.model_freshness_flags.push({ page: category.slug, product: product.name, issue: "Possible stale model language without a visible freshness note." });
    }
  }
}

for (const file of htmlFiles()) {
  const html = readFileSync(file, "utf8");
  const visibleText = stripVisibleText(html).toLowerCase();
  report.pages_checked += 1;

  for (const href of internalLinks(html)) {
    if (!targetExists(href)) report.broken_internal_links.push({ page: file, href });
  }

  if (!AFFILIATE_ENABLED && (/data-affiliate-link/.test(html) || />Buy Now</i.test(html) || /tag=phavai7311-20/i.test(html))) {
    report.hard_failures.push({ page: file, issue: "Affiliate mode disabled but active affiliate CTA/link markup is present." });
  }

  if (AFFILIATE_ENABLED) {
    for (const match of html.matchAll(/<a[^>]+data-affiliate-link[^>]*>/g)) {
      const tag = match[0];
      const rel = tag.match(/rel="([^"]*)"/i)?.[1] ?? "";
      if (!/\bsponsored\b/i.test(rel) || !/\bnoopener\b/i.test(rel)) {
        report.hard_failures.push({ page: file, issue: "Affiliate link is missing sponsored/noopener rel handling." });
      }
    }
    if (/data-affiliate-link/.test(html) && !/>\s*(?:Buy(?: now| men| women)?|Check price(?: at [^<]+)?|(?:Men|Women)(?:'|&#39;)s at [^<]+)\s*<\/a>/i.test(html)) {
      report.hard_failures.push({ page: file, issue: "Affiliate mode enabled but approved buy CTA copy is missing." });
    }
  }

  if (/Check retailer|A buyer-facing score built from eligible expert reviews/i.test(visibleText)) {
    report.hard_failures.push({ page: file, issue: "Old CTA or repeated score-explanation copy is still visible." });
  }

  for (const label of ["Custom score", "Source agreement", "Evidence depth", "Quality", "Value", "Durability", "Affordability", "Confidence", "Confidence-to-Buy", "Regret Risk"]) {
    if (new RegExp(`>${label}<`, "i").test(html)) {
      report.hard_failures.push({ page: file, issue: `Disallowed public score label is visible: ${label}.` });
    }
  }

  if (/attribute-meter-grid|snapshot-attributes/.test(html)) {
    report.hard_failures.push({ page: file, issue: "Internal attribute scores are visible on the public page." });
  }

  if (/\"@type\"\s*:\s*\"(?:AggregateRating|Offer|Review|Product)\"|priceCurrency|reviewRating/i.test(html)) {
    report.structured_data_warnings.push({
      page: file,
      issue: "Structured data includes rating, product, review, offer, or price-like schema. Verify it is fully supported by visible page content."
    });
  }

  const slug = file.replace(/\.html$/, "");
  const productCards = parseProductCards(html);
  const drawerCount = (html.match(/class="evidence-drawer"/g) ?? []).length;
  if (productCards.length && drawerCount < productCards.length) {
    report.source_drawer_warnings.push({
      page: file,
      products: productCards.length,
      drawers: drawerCount,
      issue: "One or more products do not have a public source drawer."
    });
  }
  if (/<h3>Best for<\/h3>|<h3>Avoid if<\/h3>|class="editorial-callout"|class="consensus-snapshot"/i.test(html)) {
    report.duplicate_section_warnings.push({
      page: file,
      issue: "Product card still includes duplicated decision sections or secondary summary blocks."
    });
  }

  const cutOffMatches = visibleText.match(/\b(?:a|an|the|and|or|but|that|who|for|to|of|at|by|if|as|from|into|onto|around|about|over|under|through|without|because|while)\./gi) ?? [];
  if (cutOffMatches.length) {
    report.cut_off_sentence_warnings.push({
      page: file,
      examples: Array.from(new Set(cutOffMatches)).slice(0, 5)
    });
  }

  for (let index = 0; index < productCards.length - 1; index += 1) {
    const current = productCards[index];
    const next = productCards[index + 1];
    if (current.score + 0.1 < next.score) {
      report.ranking_order_warnings.push({
        page: file,
        product: current.productName,
        issue: `Ranked above ${next.productName} despite a lower BestPick score.`
      });
    }

    const currentEvidence = productEvidenceByPage.get(`${slug}::${current.productName}`);
    const nextEvidence = productEvidenceByPage.get(`${slug}::${next.productName}`);
    if (currentEvidence && nextEvidence && currentEvidence.qualityScore + 3 < nextEvidence.qualityScore && current.score <= next.score + 1) {
      report.ranking_order_warnings.push({
        page: file,
        product: current.productName,
        issue: `Potential evidence-depth contradiction: ranked above ${next.productName} with much thinner public evidence.`
      });
    }
  }

  for (const product of parseChannelScores(html)) {
    const evidence = productEvidenceByPage.get(`${slug}::${product.productName}`);
    if (!evidence) continue;
    if (typeof product.scores.YouTube === "number" && !evidence.youtube.length) {
      report.scoring_evidence_mismatches.push({ page: slug, product: product.productName, issue: "YouTube score displayed without exact YouTube evidence." });
    }
    if (typeof product.scores.Reddit === "number" && !evidence.reddit.length) {
      report.scoring_evidence_mismatches.push({ page: slug, product: product.productName, issue: "Reddit score displayed without exact Reddit evidence." });
    }
  }

  for (const pattern of [
    "for shoppers who want runners who want",
    "for shoppers buyers who need",
    "that want a.",
    "with tradeoffs worth weighing",
    "credible contender",
    "source mix",
    "corpus",
    "sentiment",
    "ai confidence"
  ]) {
    if (visibleText.includes(pattern)) {
      report.repeated_or_awkward_copy.push({ page: file, pattern });
    }
  }
}

report.hard_failures.push(...report.scoring_evidence_mismatches);
report.hard_failures.push(...report.broken_internal_links);
report.source_priority_focus = Array.from(sourcePriorityByPage.values())
  .sort((a, b) => b.priority_score - a.priority_score || b.products_to_improve - a.products_to_improve || a.title.localeCompare(b.title))
  .slice(0, 15);
writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(`Quality governance audit checked ${report.pages_checked} pages and ${report.products_checked} products.`);
console.log(`Affiliate mode: ${AFFILIATE_ENABLED ? "enabled" : "disabled"}.`);
console.log(`Thin evidence products: ${report.products_with_thin_evidence.length}.`);
console.log(`Hard failures: ${report.hard_failures.length}.`);
console.log(`Report: ${REPORT_PATH}`);

if (report.hard_failures.length) {
  process.exitCode = 1;
}
