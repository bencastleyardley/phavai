import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import ejs from "ejs";

const categories = JSON.parse(readFileSync("data/categories.json", "utf8").replace(/^\uFEFF/, ""));
const sections = JSON.parse(readFileSync("data/sections.json", "utf8").replace(/^\uFEFF/, ""));
const supportingPages = JSON.parse(readFileSync("data/supporting.json", "utf8").replace(/^\uFEFF/, ""));
const imageSources = JSON.parse(readFileSync("data/image-sources.json", "utf8").replace(/^\uFEFF/, ""));
const sourceGovernance = JSON.parse(readFileSync("data/source-governance.json", "utf8").replace(/^\uFEFF/, ""));
const categoryTemplate = readFileSync("templates/category.ejs", "utf8");
const sectionTemplate = readFileSync("templates/section.ejs", "utf8");
const supportingTemplate = readFileSync("templates/supporting.ejs", "utf8");

const DEFAULT_MEASUREMENT_CONFIG = {
  ga4MeasurementId: "G-YD9YDB3YGT",
  bingSiteVerification: "2B9DC6FC5FA254DDA867340D39C066E1"
};

const analyticsConfig = {
  ga4MeasurementId: firstEnv("PHAVAI_GA4_MEASUREMENT_ID", "GA4_MEASUREMENT_ID", "GOOGLE_ANALYTICS_ID") || DEFAULT_MEASUREMENT_CONFIG.ga4MeasurementId,
  clarityProjectId: firstEnv("PHAVAI_CLARITY_PROJECT_ID", "CLARITY_PROJECT_ID", "MICROSOFT_CLARITY_PROJECT_ID"),
  googleSiteVerification: firstEnv("PHAVAI_GOOGLE_SITE_VERIFICATION", "GOOGLE_SITE_VERIFICATION"),
  bingSiteVerification: firstEnv("PHAVAI_BING_SITE_VERIFICATION", "BING_SITE_VERIFICATION") || DEFAULT_MEASUREMENT_CONFIG.bingSiteVerification
};

const AFFILIATE_CONFIG = {
  amazonTrackingId: firstEnv("PHAVAI_AMAZON_TRACKING_ID", "AMAZON_ASSOCIATE_TAG", "AMAZON_TRACKING_ID") || "phavai7311-20"
};

const DEFAULT_SOURCE_WEIGHTS = {
  Expert: 40,
  YouTube: 30,
  Reddit: 30
};

const TIER_WEIGHTS = {
  "Tier 1": 1,
  "Tier 2": 0.78,
  "Tier 3": 0.58
};

const SOURCE_DISPLAY_ORDER = {
  expert: 10,
  youtube: 20,
  reddit: 30,
  specs: 40,
  brand: 45,
  retailer: 50
};

const SOURCE_LABELS = {
  expert: "Expert review",
  youtube: "Video review",
  reddit: "Owner discussion",
  specs: "Specs page",
  brand: "Brand page",
  retailer: "Retailer page"
};

const SOURCE_TIER_DISPLAY = {
  expert: {
    label: "Expert",
    description: "Hands-on reviews and category testing."
  },
  youtube: {
    label: "YouTube",
    description: "Video reviews that show fit, setup, and real-world use."
  },
  reddit: {
    label: "Reddit",
    description: "Owner discussion that surfaces repeated praise and complaints."
  }
};

const CORE_ROUNDUP_SLUGS = new Set([
  "best-mens-trail-running-shoes",
  "best-womens-trail-running-shoes",
  "best-running-headphones",
  "best-gps-running-watches",
  "best-hydration-packs",
  "best-trail-running-poles",
  "best-running-vests",
  "best-recovery-sandals",
  "best-standing-desks",
  "best-office-chairs",
  "best-webcams-for-remote-work",
  "best-desk-mats",
  "best-monitor-arms",
  "best-ergonomic-keyboards",
  "best-carry-on-luggage",
  "best-coffee-makers",
  "best-massage-guns",
  "best-air-purifiers"
]);

const CATEGORY_ICON_SVGS = {
  outdoor: `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 46 24 18l10 18 7-10 15 20H8Z"/><path d="M23 28h7m11 8h6"/></svg>`,
  "remote-work": `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="12" y="14" width="40" height="28" rx="4"/><path d="M24 52h16m-8-10v10"/></svg>`,
  lifestyle: `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="18" y="18" width="28" height="34" rx="6"/><path d="M25 18v-4h14v4M18 30h28"/></svg>`
};

const REVIEW_ICON_BY_SLUG = {
  "best-mens-trail-running-shoes": `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M10 41c8 2 18-4 25-16l16 11c4 3 4 9-2 11H19c-5 0-8-2-9-6Z"/><path d="M31 28l6 5m-12 0 7 5"/></svg>`,
  "best-womens-trail-running-shoes": `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M11 42c10 1 17-5 23-15l17 9c3 4 2 10-4 11H18c-4 0-7-2-7-5Z"/><path d="M28 30h8m-13 6h10"/></svg>`,
  "best-running-headphones": `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M16 36V28a16 16 0 0 1 32 0v8"/><rect x="10" y="34" width="10" height="16" rx="5"/><rect x="44" y="34" width="10" height="16" rx="5"/></svg>`,
  "best-gps-running-watches": `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="22" y="18" width="20" height="28" rx="8"/><path d="M26 18V8h12v10M26 46v10h12V46m-6-19v7l5 4"/></svg>`,
  "best-hydration-packs": `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M23 12h18l6 14v26H17V26l6-14Z"/><path d="M24 28h16M24 38h16M32 12v40"/></svg>`,
  "best-trail-running-poles": `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M24 8v48M40 8v48M18 18h12M34 18h12M20 56h8m8 0h8"/></svg>`,
  "best-running-vests": `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M22 12h20l7 16v24H15V28l7-16Z"/><path d="M25 12v40M39 12v40M25 31h14"/></svg>`,
  "best-recovery-sandals": `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M14 43c7-12 18-17 36-16 2 12-6 20-21 20-7 0-12-1-15-4Z"/><path d="M29 29c3 4 4 9 2 16"/></svg>`,
  "best-standing-desks": `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M10 26h44M16 26v28m32-28v28M20 14h24v12"/></svg>`,
  "best-office-chairs": `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M23 10h18l2 26H21l2-26ZM18 36h28v8H18zM32 44v12m-11 0h22"/></svg>`,
  "best-webcams-for-remote-work": `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="16" y="16" width="32" height="24" rx="8"/><circle cx="32" cy="28" r="6"/><path d="M24 50h16m-8-10v10"/></svg>`,
  "best-desk-mats": `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="12" y="18" width="40" height="28" rx="5"/><path d="M20 26h24M20 34h18"/></svg>`,
  "best-monitor-arms": `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="10" y="12" width="36" height="28" rx="4"/><path d="M46 26h8v20H34m-6-6v10"/></svg>`,
  "best-ergonomic-keyboards": `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="10" y="20" width="44" height="26" rx="5"/><path d="M18 29h4m7 0h4m7 0h4M18 37h28"/></svg>`,
  "best-carry-on-luggage": `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="18" y="16" width="28" height="36" rx="6"/><path d="M26 16v-5h12v5M24 52v4m16-4v4M28 24h8"/></svg>`,
  "best-coffee-makers": `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M18 22h28v14a12 12 0 0 1-24 0V22Z"/><path d="M46 27h4a6 6 0 0 1 0 12h-4M24 12v5m8-5v5m8-5v5"/></svg>`,
  "best-massage-guns": `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="26" y="11" width="16" height="28" rx="7" transform="rotate(35 34 25)"/><path d="M23 34 13 49m29-28 9-7M44 42l6 8"/></svg>`,
  "best-air-purifiers": `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="18" y="10" width="28" height="44" rx="8"/><path d="M25 22h14M25 30h14M25 38h14"/><circle cx="32" cy="47" r="2"/></svg>`
};

const REVIEW_ICON_RULES = [
  [/headphone|earbud/i, `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M16 36V28a16 16 0 0 1 32 0v8"/><rect x="10" y="34" width="10" height="16" rx="5"/><rect x="44" y="34" width="10" height="16" rx="5"/></svg>`],
  [/watch|gps/i, `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="22" y="18" width="20" height="28" rx="8"/><path d="M26 18V8h12v10M26 46v10h12V46m-6-19v7l5 4"/></svg>`],
  [/hydration|vest|pack/i, `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M23 12h18l6 14v26H17V26l6-14Z"/><path d="M24 28h16M24 38h16M32 12v40"/></svg>`],
  [/pole/i, `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M24 8v48M40 8v48M18 18h12M34 18h12M20 56h8m8 0h8"/></svg>`],
  [/sandal|slide|recovery/i, `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M14 43c7-12 18-17 36-16 2 12-6 20-21 20-7 0-12-1-15-4Z"/><path d="M29 29c3 4 4 9 2 16"/></svg>`],
  [/desk/i, `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M10 26h44M16 26v28m32-28v28M20 14h24v12"/></svg>`],
  [/chair/i, `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M23 10h18l2 26H21l2-26ZM18 36h28v8H18zM32 44v12m-11 0h22"/></svg>`],
  [/webcam/i, `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="16" y="16" width="32" height="24" rx="8"/><circle cx="32" cy="28" r="6"/><path d="M24 50h16m-8-10v10"/></svg>`],
  [/mat/i, `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="12" y="18" width="40" height="28" rx="5"/><path d="M20 26h24M20 34h18"/></svg>`],
  [/monitor|arm/i, `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="10" y="12" width="36" height="28" rx="4"/><path d="M46 26h8v20H34m-6-6v10"/></svg>`],
  [/keyboard/i, `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="10" y="20" width="44" height="26" rx="5"/><path d="M18 29h4m7 0h4m7 0h4M18 37h28"/></svg>`],
  [/luggage|carry/i, `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="18" y="16" width="28" height="36" rx="6"/><path d="M26 16v-5h12v5M24 52v4m16-4v4M28 24h8"/></svg>`],
  [/coffee/i, `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M18 22h28v14a12 12 0 0 1-24 0V22Z"/><path d="M46 27h4a6 6 0 0 1 0 12h-4M24 12v5m8-5v5m8-5v5"/></svg>`],
  [/massage/i, `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="26" y="11" width="16" height="28" rx="7" transform="rotate(35 34 25)"/><path d="M23 34 13 49m29-28 9-7M44 42l6 8"/></svg>`],
  [/purifier|air/i, `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="18" y="10" width="28" height="44" rx="8"/><path d="M25 22h14M25 30h14M25 38h14"/><circle cx="32" cy="47" r="2"/></svg>`],
  [/shoe|trainer|trail|marathon/i, `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M10 40c9 2 18-4 25-15l16 11c4 3 4 9-2 11H19c-5 0-8-2-9-7Z"/><path d="M31 28l6 5m-12 0 7 5"/></svg>`]
];

const DEFAULT_REVIEW_ICON = `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="14" y="14" width="36" height="36" rx="8"/><path d="M23 28h18M23 36h12"/></svg>`;

const ONE_MONTH_MS = 1000 * 60 * 60 * 24 * 30.4375;
const SITE_LAST_MODIFIED = "2026-04-22";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function firstEnv(...names) {
  return names.map((name) => process.env[name]).find((value) => value && value.trim())?.trim() ?? "";
}

function toIsoDate(value) {
  if (!value) return SITE_LAST_MODIFIED;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return SITE_LAST_MODIFIED;
  return parsed.toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[char]);
}

function iconSvg(slug) {
  return CATEGORY_ICON_SVGS[slug] ?? DEFAULT_REVIEW_ICON;
}

function reviewIconFor(category) {
  if (REVIEW_ICON_BY_SLUG[category.slug]) return REVIEW_ICON_BY_SLUG[category.slug];
  const haystack = `${category.title} ${category.slug}`.toLowerCase();
  return REVIEW_ICON_RULES.find(([pattern]) => pattern.test(haystack))?.[1] ?? DEFAULT_REVIEW_ICON;
}

function parseDomain(url = "") {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function withAmazonAffiliateTag(url = "") {
  if (!url || !AFFILIATE_CONFIG.amazonTrackingId) return url;

  try {
    const parsed = new URL(url);
    const isAmazon = /(^|\.)amazon\.com$/i.test(parsed.hostname);
    if (!isAmazon) return url;

    parsed.searchParams.set("tag", AFFILIATE_CONFIG.amazonTrackingId);
    if (!parsed.searchParams.has("linkCode")) parsed.searchParams.set("linkCode", "ll2");
    if (!parsed.searchParams.has("language")) parsed.searchParams.set("language", "en_US");
    if (!parsed.searchParams.has("ref_")) parsed.searchParams.set("ref_", "as_li_ss_tl");
    return parsed.toString();
  } catch {
    return url;
  }
}

function parseYouTubeId(url = "") {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return parsed.pathname.split("/").filter(Boolean)[0] ?? "";
    if (parsed.hostname.includes("youtube.com")) return parsed.searchParams.get("v") ?? "";
  } catch {
    return "";
  }
  return "";
}

function parseRedditSubreddit(url = "") {
  const match = url.match(/reddit\.com\/r\/([^/]+)/i);
  return match?.[1] ?? "";
}

function hasExactPublicUrl(item) {
  const url = item.url ?? "";
  if (!url) return false;
  if (url.includes("youtube.com/results") || url.includes("reddit.com/search")) return false;
  return /^https?:\/\//.test(url);
}

function inferSourceType(item) {
  const url = item.url ?? "";
  const name = `${item.sourceName ?? ""} ${item.evidenceType ?? ""}`.toLowerCase();
  if (item.source_type) return item.source_type;
  if (item.channel === "YouTube" || url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (item.channel === "Reddit" || url.includes("reddit.com")) return "reddit";
  if (name.includes("retailer")) return "retailer";
  if (name.includes("product documentation") || name.includes("official product documentation") || name.includes("spec")) return "specs";
  if (name.includes("brand")) return "brand";
  return "expert";
}

function sourceTierKey(tier = "") {
  if (/1/.test(tier)) return "tier1";
  if (/2/.test(tier)) return "tier2";
  return "tier3";
}

function legacyTierLabel(sourceTier = "tier3") {
  if (sourceTier === "tier1") return "Tier 1";
  if (sourceTier === "tier2") return "Tier 2";
  return "Tier 3";
}

function trustReasonForSource(item, category) {
  if (item.trust_reason) return item.trust_reason;
  const sectionTrust = sourceGovernance.sections?.[category.sectionSlug]?.tierLabels?.[item.source_tier];
  if (sectionTrust) return sectionTrust;
  const fallback = sourceGovernance.globalTierLabels?.[item.source_tier];
  if (fallback) return fallback;
  if (item.source_type === "youtube") return "Useful visual testing context from a product-specific review.";
  if (item.source_type === "reddit") return "Owner discussion helps surface fit, durability, and setup caveats.";
  if (item.source_type === "specs") return "Useful for confirming product details, not for proving rank.";
  return "Hands-on or category-specific editorial testing.";
}

function normalizeEvidenceItem(item, product, category, index) {
  const sourceType = inferSourceType(item);
  const sourceTier = item.source_tier ?? sourceTierKey(item.tier);
  const exactPublicUrl = hasExactPublicUrl(item);
  const isGenericDiscovery = !exactPublicUrl || /corpus|sentiment sample|discovery/i.test(`${item.sourceName ?? ""} ${item.evidenceType ?? ""}`);
  const videoId = sourceType === "youtube" ? (item.video_id ?? parseYouTubeId(item.url)) : undefined;
  const subreddit = sourceType === "reddit" ? (item.subreddit ?? parseRedditSubreddit(item.url)) : undefined;
  const isPublic = item.is_public ?? (exactPublicUrl && !isGenericDiscovery);
  const isPrimarySource = item.is_primary_source ?? (
    isPublic &&
    sourceType !== "specs" &&
    sourceType !== "brand" &&
    sourceType !== "retailer" &&
    sourceTier === "tier1"
  );

  return {
    ...item,
    channel: item.channel ?? (sourceType === "youtube" ? "YouTube" : sourceType === "reddit" ? "Reddit" : "Expert"),
    tier: item.tier ?? legacyTierLabel(sourceTier),
    source_type: sourceType,
    source_tier: sourceTier,
    sourceLabel: SOURCE_LABELS[sourceType] ?? "Source",
    title: item.title ?? item.sourceName ?? "Untitled source",
    publisher: item.publisher ?? item.sourceName ?? parseDomain(item.url),
    author: item.author ?? "",
    url: item.url ?? "",
    publish_date: item.publish_date ?? item.publishedAt ?? "",
    publishedAt: item.publishedAt ?? item.publish_date ?? "",
    checked_date: item.checked_date ?? item.verifiedAt ?? category.sourcesVerifiedAt ?? category.updated,
    verifiedAt: item.verifiedAt ?? item.checked_date ?? category.sourcesVerifiedAt ?? category.updated,
    product_name: item.product_name ?? product.name,
    page_use_case: item.page_use_case ?? category.title,
    evidence_note: item.evidence_note ?? item.summary ?? "",
    summary: item.summary ?? item.evidence_note ?? "",
    trust_reason: trustReasonForSource({ ...item, source_type: sourceType, source_tier: sourceTier }, category),
    evidence_polarity: inferEvidencePolarity(item),
    is_primary_source: isPrimarySource,
    display_order: item.display_order ?? ((SOURCE_DISPLAY_ORDER[sourceType] ?? 90) + index / 100),
    is_public: isPublic,
    is_exact_url: exactPublicUrl,
    is_generic_discovery: isGenericDiscovery,
    video_id: videoId,
    timestamp_start: item.timestamp_start ?? null,
    timestamp_label: item.timestamp_label ?? (sourceType === "youtube" ? "Product discussion" : ""),
    subreddit,
    thread_type: item.thread_type ?? (sourceType === "reddit" ? "post" : ""),
    permalink_type: item.permalink_type ?? (sourceType === "reddit" ? (exactPublicUrl ? "exact_thread" : "search") : ""),
    discussion_quality: item.discussion_quality ?? (sourceType === "reddit" ? ((item.sampleSize ?? 0) >= 20 ? "high" : (item.sampleSize ?? 0) >= 8 ? "medium" : "low") : ""),
    domain: parseDomain(item.url)
  };
}

function publicSourceSort(a, b) {
  if (Number(b.is_primary_source) !== Number(a.is_primary_source)) {
    return Number(b.is_primary_source) - Number(a.is_primary_source);
  }
  if ((a.display_order ?? 90) !== (b.display_order ?? 90)) return (a.display_order ?? 90) - (b.display_order ?? 90);
  const tierDelta = (TIER_WEIGHTS[legacyTierLabel(b.source_tier)] ?? 0.58) - (TIER_WEIGHTS[legacyTierLabel(a.source_tier)] ?? 0.58);
  if (tierDelta !== 0) return tierDelta;
  return (b.evidenceWeight ?? 0) - (a.evidenceWeight ?? 0);
}

function selectPublicEvidence(evidence, limit = 6) {
  const publicItems = evidence
    .filter((item) => item.is_public)
    .sort(publicSourceSort);

  const selected = [];
  for (const sourceType of ["expert", "youtube", "reddit", "specs", "brand"]) {
    const match = publicItems.find((item) => item.source_type === sourceType && !selected.includes(item));
    if (match) selected.push(match);
  }

  for (const item of publicItems) {
    if (selected.length >= limit) break;
    if (!selected.includes(item)) selected.push(item);
  }

  return selected.slice(0, limit);
}

function bestDisplayEvidence(evidence) {
  const publicEvidence = evidence.filter((item) => item.is_public);
  const nonBrandEvidence = publicEvidence.filter((item) => !["brand", "specs", "retailer"].includes(item.source_type));
  const candidates = nonBrandEvidence.length ? nonBrandEvidence : publicEvidence;
  return [...candidates].sort(publicSourceSort)[0] ?? [...evidence].sort((a, b) => b.evidenceWeight - a.evidenceWeight)[0];
}

function cleanSentence(value = "") {
  const trimmed = String(value).trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function summarizeLikes(product) {
  const themes = (product.positiveThemes?.length ? product.positiveThemes : product.pros ?? [])
    .slice(0, 2)
    .map(cleanSentence)
    .filter(Boolean);

  if (themes.length) return themes.join(" ");
  return cleanSentence(`Best fit: ${product.bestFor}`);
}

function summarizeCautions(product) {
  const themes = (product.cautionThemes?.length ? product.cautionThemes : product.cons ?? [])
    .slice(0, 2)
    .map(cleanSentence)
    .filter(Boolean);

  if (themes.length) return themes.join(" ");
  return cleanSentence(`Skip it if ${product.avoidIf}`);
}

function sourceBucketSort(bucket) {
  return (a, b) => {
    if (bucket === "caution") {
      if ((a.score ?? 100) !== (b.score ?? 100)) return (a.score ?? 100) - (b.score ?? 100);
    }
    return publicSourceSort(a, b);
  };
}

function sourceUrlKey(item) {
  return String(item.url ?? "").split("#")[0].split("?si=")[0].trim().toLowerCase().replace(/\/$/, "");
}

function inferEvidencePolarity(item) {
  const haystack = `${item.title ?? ""} ${item.summary ?? ""} ${item.evidence_note ?? ""} ${item.evidenceType ?? ""}`.toLowerCase();
  const score = item.score ?? 82;
  const cautionWords = [
    "caution",
    "complaint",
    "negative",
    "drawback",
    "issue",
    "problem",
    "narrow",
    "tight",
    "firm",
    "sloppy",
    "unstable",
    "durability",
    "delaminate",
    "rubbing",
    "hotspot",
    "ankle roll",
    "size up",
    "sizing",
    "disappointed",
    "not favorite",
    "low volume",
    "toe box"
  ];

  if (item.evidence_polarity) return item.evidence_polarity;
  if (score <= 78) return "caution";
  if (score <= 83 && cautionWords.some((word) => haystack.includes(word))) return "caution";
  if (score >= 84) return "positive";
  return "mixed";
}

function sourceMatchesBucket(item, bucket) {
  const polarity = item.evidence_polarity ?? inferEvidencePolarity(item);
  if (bucket === "like") return polarity === "positive" || polarity === "mixed";
  return polarity === "caution";
}

function selectSourcesByType(evidence, sourceType, bucket, limit = 3, options = {}) {
  const excludeUrls = options.excludeUrls ?? new Set();
  const candidates = evidence
    .filter((item) => item.is_public && item.source_type === sourceType)
    .filter((item) => item.url && !item.is_generic_discovery)
    .filter((item) => !excludeUrls.has(sourceUrlKey(item)))
    .filter((item) => sourceMatchesBucket(item, bucket))
    .sort(sourceBucketSort(bucket));

  return candidates.slice(0, limit);
}

function buildEvidenceGroups(evidence, bucket) {
  return [
    {
      label: "Expert reviews",
      sources: selectSourcesByType(evidence, "expert", bucket, bucket === "like" ? 3 : 2)
    },
    {
      label: "YouTube testing",
      sources: selectSourcesByType(evidence, "youtube", bucket, 3)
    },
    {
      label: "Reddit owner discussion",
      sources: selectSourcesByType(evidence, "reddit", bucket, 3)
    }
  ].filter((group) => group.sources.length);
}

function interpretationForTier(product, sourceType, bucket) {
  const summary = bucket === "like" ? summarizeLikes(product) : summarizeCautions(product);
  if (sourceType === "expert") {
    return bucket === "like"
      ? `Expert reviews support the upside: ${summary}`
      : `Expert reviews make the tradeoff clear: ${summary}`;
  }

  if (sourceType === "youtube") {
    return bucket === "like"
      ? `Video reviews help confirm how it performs in use: ${summary}`
      : `Video reviews are useful for spotting this before checkout: ${summary}`;
  }

  return bucket === "like"
    ? `Owner discussion reinforces the main appeal: ${summary}`
    : `Owner discussion helps show whether this downside will matter to you: ${summary}`;
}

function buildEvidenceTiers(product, evidence) {
  return ["expert", "youtube", "reddit"].map((sourceType) => {
    const likes = selectSourcesByType(evidence, sourceType, "like", sourceType === "expert" ? 3 : 3);
    const usedLikeUrls = new Set(likes.map(sourceUrlKey));
    const cautions = selectSourcesByType(evidence, sourceType, "caution", sourceType === "expert" ? 2 : 3, {
      excludeUrls: usedLikeUrls
    });

    return {
      key: sourceType,
      ...SOURCE_TIER_DISPLAY[sourceType],
      likes: {
        interpretation: interpretationForTier(product, sourceType, "like"),
        sources: likes
      },
      cautions: {
        interpretation: interpretationForTier(product, sourceType, "caution"),
        sources: cautions
      }
    };
  }).filter((tier) => tier.likes.sources.length || tier.cautions.sources.length);
}

function buildEvidenceSummary(product, channelScores) {
  const evidence = channelScores.flatMap((row) => row.evidence);

  return {
    likes: {
      interpretation: summarizeLikes(product),
      groups: buildEvidenceGroups(evidence, "like")
    },
    cautions: {
      interpretation: summarizeCautions(product),
      groups: buildEvidenceGroups(evidence, "caution")
    },
    tiers: buildEvidenceTiers(product, evidence)
  };
}

function parsePriceBand(price = "") {
  const values = Array.from(String(price).matchAll(/\$([0-9,]+)(?:\s*-\s*\$?([0-9,]+))?/g))
    .flatMap((match) => [match[1], match[2]].filter(Boolean))
    .map((value) => Number(value.replace(/,/g, "")))
    .filter((value) => Number.isFinite(value));

  if (!values.length) return null;
  return {
    low: Math.min(...values),
    high: Math.max(...values)
  };
}

function formatDollars(value) {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function buildPriceInsight(product) {
  const band = parsePriceBand(product.price);
  if (!band) {
    return {
      typical: product.price,
      fair: product.price,
      goodDeal: "Check multiple sellers",
      waitFor: "Watch size and color pricing",
      high: "Avoid inflated marketplace listings",
      note: "Price varies by retailer, color, and size. Use the current price against the typical retail note before buying."
    };
  }

  const fairLow = band.low;
  const fairHigh = Math.max(band.high, band.low);
  const goodDeal = fairLow * 0.85;
  const waitFor = fairLow * 0.75;
  const high = fairHigh * 1.1;

  return {
    typical: product.price,
    fair: fairLow === fairHigh ? `Around ${formatDollars(fairLow)}` : `${formatDollars(fairLow)}-${formatDollars(fairHigh)}`,
    goodDeal: `Under ${formatDollars(goodDeal)}`,
    waitFor: `Under ${formatDollars(waitFor)}`,
    high: `Above ${formatDollars(high)}`,
    note: "These checkpoints are based on the stored typical retail band, not a live price-history tracker. Sizes and colors can swing a lot, so compare the current price before you click through."
  };
}

function renderMeasurementTags() {
  const tags = [];

  if (analyticsConfig.googleSiteVerification) {
    tags.push(`<meta name="google-site-verification" content="${escapeHtml(analyticsConfig.googleSiteVerification)}" />`);
  }

  if (analyticsConfig.bingSiteVerification) {
    tags.push(`<meta name="msvalidate.01" content="${escapeHtml(analyticsConfig.bingSiteVerification)}" />`);
  }

  if (analyticsConfig.ga4MeasurementId) {
    const id = escapeHtml(analyticsConfig.ga4MeasurementId);
    tags.push(`<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag("js", new Date());
    gtag("config", "${id}", {
      anonymize_ip: true,
      transport_type: "beacon"
    });
  </script>`);
  }

  if (analyticsConfig.clarityProjectId) {
    const id = escapeHtml(analyticsConfig.clarityProjectId);
    tags.push(`<script>
    (function(c,l,a,r,i,t,y){
      c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
      y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "${id}");
  </script>`);
  }

  return tags.length ? `\n  <!-- Phavai measurement and webmaster tags: generated at build time from site config and environment variables. -->\n  ${tags.join("\n  ")}\n` : "";
}

function injectMeasurementTags() {
  const tags = renderMeasurementTags();
  for (const file of readdirSync(".")) {
    if (!file.endsWith(".html")) continue;
    const html = readFileSync(file, "utf8");
    const withoutOldTags = html.replace(/\n\s*<!-- Phavai measurement and webmaster tags:[\s\S]*?\n(?=\s*<\/head>)/, "\n");
    const nextHtml = tags ? withoutOldTags.replace("</head>", `${tags}</head>`) : withoutOldTags;
    if (nextHtml !== html) writeFileSync(file, nextHtml, "utf8");
  }
}

function weightedMean(items) {
  const totalWeight = items.reduce((total, row) => total + row.weight, 0);
  return items.reduce((total, row) => total + row.score * row.weight, 0) / totalWeight;
}

function weightedStandardDeviation(items, mean) {
  const totalWeight = items.reduce((total, row) => total + row.weight, 0);
  const variance = items.reduce((total, row) => {
    return total + row.weight * Math.pow(row.score - mean, 2);
  }, 0) / totalWeight;

  return Math.sqrt(variance);
}

function monthsBetween(startDate, endDate) {
  return Math.max(0, (new Date(endDate) - new Date(startDate)) / ONE_MONTH_MS);
}

function freshnessWeight(publishedAt, categoryUpdatedAt) {
  if (!publishedAt) return 0.62;

  const monthsOld = monthsBetween(publishedAt, categoryUpdatedAt);
  if (monthsOld <= 3) return 1;
  if (monthsOld <= 9) return 0.92;
  if (monthsOld <= 18) return 0.8;
  if (monthsOld <= 30) return 0.66;
  return 0.5;
}

function sampleWeight(sampleSize = 1) {
  return clamp(0.65 + Math.log10(sampleSize + 1) * 0.22, 0.65, 1);
}

function evidenceWeight(evidence, categoryUpdatedAt) {
  const tier = TIER_WEIGHTS[evidence.tier] ?? 0.58;
  const freshness = freshnessWeight(evidence.publishedAt, categoryUpdatedAt);
  const sample = sampleWeight(evidence.sampleSize);
  const relevance = clamp(evidence.relevance ?? 0.75, 0.35, 1);

  return tier * freshness * sample * relevance;
}

function buildChannelScores(product, category) {
  const channels = Object.keys(category.sourceWeights ?? DEFAULT_SOURCE_WEIGHTS);

  return channels
    .map((channel) => {
      const evidence = product.evidence
        .filter((item) => item.channel === channel)
        .map((item) => ({
          ...item,
          evidenceWeight: evidenceWeight(item, category.updated)
        }));

      if (!evidence.length) return null;

      const score = weightedMean(evidence.map((item) => ({
        score: item.score,
        weight: item.evidenceWeight
      })));

      return {
        source: channel,
        weight: category.sourceWeights?.[channel] ?? DEFAULT_SOURCE_WEIGHTS[channel],
        score: Number(score.toFixed(1)),
        evidenceCount: evidence.length,
        tier: bestTierLabel(evidence),
        summary: summarizeEvidence(evidence),
        topEvidence: bestDisplayEvidence(evidence),
        evidence
      };
    })
    .filter(Boolean);
}

function bestTierLabel(evidence) {
  if (evidence.some((item) => item.tier === "Tier 1")) return "Tier 1 evidence";
  if (evidence.some((item) => item.tier === "Tier 2")) return "Tier 2 evidence";
  return "Tier 3 evidence";
}

function summarizeEvidence(evidence) {
  const strongest = [...evidence].sort((a, b) => b.evidenceWeight - a.evidenceWeight)[0];
  if (evidence.length === 1) return strongest.summary;

  return `${evidence.length} evidence items. Strongest signal: ${strongest.summary}`;
}

function computeSignal(product, channelScores, category) {
  const evidence = product.evidence ?? [];
  const channelsWithEvidence = new Set(evidence.map((item) => item.channel)).size;
  const expectedChannels = Object.keys(category.sourceWeights ?? DEFAULT_SOURCE_WEIGHTS).length;
  const averageFreshness = evidence.length
    ? evidence.reduce((total, item) => total + freshnessWeight(item.publishedAt, category.updated), 0) / evidence.length
    : 0;
  const averageTier = evidence.length
    ? evidence.reduce((total, item) => total + (TIER_WEIGHTS[item.tier] ?? 0.58), 0) / evidence.length
    : 0;
  const sampleTotal = evidence.reduce((total, item) => total + (item.sampleSize ?? 1), 0);

  const countScore = clamp(evidence.length / 12, 0, 1);
  const diversityScore = clamp(channelsWithEvidence / expectedChannels, 0, 1);
  const sampleScore = clamp(Math.log10(sampleTotal + 1) / 2, 0, 1);
  const channelDepthScore = clamp(channelScores.reduce((total, row) => total + row.evidenceCount, 0) / (expectedChannels * 3), 0, 1);

  const raw = 1 + 4 * (
    countScore * 0.22 +
    diversityScore * 0.22 +
    averageFreshness * 0.16 +
    averageTier * 0.14 +
    sampleScore * 0.12 +
    channelDepthScore * 0.14
  );

  return Number(clamp(raw, 1, 5).toFixed(1));
}

function computeProductScores(product, category) {
  const imageInfo = imageSources[product.image] ?? {
    sourceName: "Uncataloged image",
    sourceUrl: "",
    credit: "",
    license: "",
    licenseUrl: "",
    requiresAttribution: false,
    exactProduct: false,
    usage: "Image source metadata needs review before this page is treated as production-complete."
  };
  const normalizedEvidence = (product.evidence ?? []).map((item, index) => normalizeEvidenceItem(item, product, category, index));
  const normalizedProduct = { ...product, evidence: normalizedEvidence };
  const channelScores = buildChannelScores(normalizedProduct, category);
  const rawScore = weightedMean(channelScores.map((row) => ({
    score: row.score,
    weight: row.weight
  })));
  const disagreement = weightedStandardDeviation(channelScores.map((row) => ({
    score: row.score,
    weight: row.weight
  })), rawScore);
  const signal = computeSignal(product, channelScores, category);

  return {
    ...normalizedProduct,
    affiliateUrl: withAmazonAffiliateTag(normalizedProduct.affiliateUrl),
    imageInfo,
    priceInsight: buildPriceInsight(normalizedProduct),
    sourceScores: channelScores,
    evidenceSummary: buildEvidenceSummary(normalizedProduct, channelScores),
    publicEvidence: selectPublicEvidence(channelScores.flatMap((row) => row.evidence)),
    internalEvidenceCount: normalizedEvidence.filter((item) => !item.is_public).length,
    rawBestPickScore: Number(rawScore.toFixed(1)),
    bestPickScore: Math.round(rawScore),
    consensus: Math.round(clamp(100 - disagreement * 4, 0, 100)),
    signal,
    evidenceCount: normalizedEvidence.length
  };
}

const sectionsBySlug = new Map(sections.map((section) => [section.slug, section]));
const supportBySection = new Map(
  sections.map((section) => [
    section.slug,
    supportingPages.filter((page) => page.sectionSlug === section.slug)
  ])
);
const builtCategories = categories.map((category) => {
  const sourceWeights = category.sourceWeights ?? DEFAULT_SOURCE_WEIGHTS;
  const expertScoreFor = (product) => product.sourceScores.find((row) => row.source === "Expert")?.score ?? 0;
  const products = category.products
    .map((product) => computeProductScores(product, { ...category, sourceWeights }))
    .sort((a, b) => {
      if (b.bestPickScore !== a.bestPickScore) return b.bestPickScore - a.bestPickScore;
      const expertDelta = expertScoreFor(b) - expertScoreFor(a);
      if (Math.abs(expertDelta) >= 0.1) return expertDelta;
      if (b.rawBestPickScore !== a.rawBestPickScore) return b.rawBestPickScore - a.rawBestPickScore;
      if (b.consensus !== a.consensus) return b.consensus - a.consensus;
      return b.signal - a.signal;
    })
    .map((product, index) => ({ ...product, rank: index + 1 }));

  return {
    ...category,
    section: sectionsBySlug.get(category.sectionSlug),
    sourceWeights,
    products,
    isCoreRoundup: CORE_ROUNDUP_SLUGS.has(category.slug),
    iconSvg: reviewIconFor(category)
  };
});

for (const category of builtCategories) {
  const relatedReviewOrder = new Map((category.relatedReviewSlugs ?? []).map((slug, index) => [slug, index]));
  const relatedReviews = builtCategories
    .filter((review) => review.sectionSlug === category.sectionSlug && review.slug !== category.slug && review.isCoreRoundup)
    .sort((a, b) => {
      const aOrder = relatedReviewOrder.has(a.slug) ? relatedReviewOrder.get(a.slug) : 1000;
      const bOrder = relatedReviewOrder.has(b.slug) ? relatedReviewOrder.get(b.slug) : 1000;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.title.localeCompare(b.title);
    })
    .map(({ products, ...review }) => ({ ...review, products: products.slice(0, 1) }));
  const html = ejs.render(
    categoryTemplate,
    {
      ...category,
      allSections: sections,
      relatedReviews,
      supportingPages: []
    },
    { rmWhitespace: false }
  );
  writeFileSync(`${category.slug}.html`, html, "utf8");
  console.log(`Built: ${category.slug}.html`);
}

for (const section of sections) {
  const reviews = builtCategories.filter((category) => category.sectionSlug === section.slug && category.isCoreRoundup);
  const html = ejs.render(
    sectionTemplate,
    {
      section: { ...section, iconSvg: iconSvg(section.slug) },
      reviews,
      supportingPages: [],
      sourceTrust: sourceGovernance.sections?.[section.slug],
      allSections: sections
    },
    { rmWhitespace: false }
  );
  writeFileSync(`${section.slug}.html`, html, "utf8");
  console.log(`Built: ${section.slug}.html`);
}

for (const page of supportingPages) {
  const section = sectionsBySlug.get(page.sectionSlug);
  const relatedReviews = builtCategories.filter((review) => page.relatedReviewSlugs.includes(review.slug));
  const html = ejs.render(
    supportingTemplate,
    { page, section, relatedReviews, allSections: sections },
    { rmWhitespace: false }
  );
  writeFileSync(`${page.slug}.html`, html, "utf8");
  console.log(`Built: ${page.slug}.html`);
}

const staticPages = ["methodology.html", "editorial-standards.html", "about.html", "contact.html", "privacy.html", "terms.html"];
const urls = [
  { loc: "https://www.phavai.com/", changefreq: "weekly", priority: "1.0", lastmod: SITE_LAST_MODIFIED },
  ...sections.map((section) => ({
    loc: `https://www.phavai.com/${section.slug}.html`,
    changefreq: "weekly",
    priority: "0.9",
    lastmod: SITE_LAST_MODIFIED
  })),
  ...builtCategories.map((category) => ({
    loc: `https://www.phavai.com/${category.slug}.html`,
    changefreq: "weekly",
    priority: "0.8",
    lastmod: toIsoDate(category.updated)
  })),
  ...supportingPages.map((page) => ({
    loc: `https://www.phavai.com/${page.slug}.html`,
    changefreq: "monthly",
    priority: "0.7",
    lastmod: toIsoDate(page.updated)
  })),
  ...staticPages.map((page) => ({
    loc: `https://www.phavai.com/${page}`,
    changefreq: page === "privacy.html" || page === "terms.html" ? "yearly" : "monthly",
    priority: page === "methodology.html" ? "0.7" : "0.5",
    lastmod: SITE_LAST_MODIFIED
  }))
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`).join("\n")}
</urlset>
`;
writeFileSync("sitemap.xml", sitemap, "utf8");
console.log("Built: sitemap.xml");
injectMeasurementTags();
console.log("Built: measurement tags");
