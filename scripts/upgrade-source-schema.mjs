import { readFileSync, writeFileSync } from "node:fs";

const categoriesPath = "data/categories.json";
const auditPath = "data/source-quality-audit.json";
const categories = JSON.parse(readFileSync(categoriesPath, "utf8").replace(/^\uFEFF/, ""));

const SOURCE_DISPLAY_ORDER = {
  expert: 10,
  youtube: 20,
  reddit: 30,
  specs: 40,
  brand: 45,
  retailer: 50
};

const EXACT_SOURCE_OVERRIDES = [
  {
    category_slug: "best-running-headphones",
    product_name: "Shokz OpenRun Pro 2",
    source_type: "reddit",
    url: "https://www.reddit.com/r/headphones/comments/1k35ph3",
    title: "Shokz OpeRun Pro 2 bone conduction is disappointing",
    publisher: "r/headphones",
    sourceName: "r/headphones owner thread",
    publishedAt: "2025-04-19",
    sampleSize: 12,
    evidence_note: "Owner discussion highlights sound leakage, bass expectations, and why open-ear safety matters more than audio quality for many runners.",
    trust_reason: "Useful counterweight because it captures buyer regret and fit-for-purpose caveats from owners."
  },
  {
    category_slug: "best-gps-running-watches",
    product_name: "Garmin Forerunner 265",
    source_type: "youtube",
    url: "https://www.youtube.com/watch?v=xIJgwH6SPyY",
    title: "Garmin Forerunner 265 In-Depth Review",
    publisher: "DC Rainmaker YouTube",
    sourceName: "DC Rainmaker YouTube",
    publishedAt: "2023-03-02",
    sampleSize: 1,
    evidence_note: "Product-specific video review covers AMOLED display, training readiness, GPS behavior, and training features.",
    trust_reason: "Strong watch-specific testing source for setup, sport features, and runner-facing use."
  },
  {
    category_slug: "best-standing-desks",
    product_name: "Uplift V2 Standing Desk",
    source_type: "reddit",
    url: "https://www.reddit.com/r/StandingDesk/comments/x2xiei/a_full_unbiased_review_of_an_uplift_desk/",
    title: "A Full Unbiased Review of an Uplift Desk",
    publisher: "r/StandingDesk",
    sourceName: "r/StandingDesk owner review",
    publishedAt: "2022-08-31",
    sampleSize: 18,
    evidence_note: "Long owner review adds assembly, customization, wobble, and cost context beyond editorial lab testing.",
    trust_reason: "Useful long-term owner perspective for a high-ticket desk where setup and stability matter."
  },
  {
    category_slug: "best-office-chairs",
    product_name: "Steelcase Gesture",
    source_type: "reddit",
    url: "https://www.reddit.com/r/OfficeChairs/comments/1gdzxb6/steelcase_gesture_review/",
    title: "Steelcase Gesture review",
    publisher: "r/OfficeChairs",
    sourceName: "r/OfficeChairs owner review",
    publishedAt: "2024-10-28",
    sampleSize: 14,
    evidence_note: "Owner review adds long-day comfort, armrest, and real-office fit context.",
    trust_reason: "Useful owner discussion for comfort details that vary by body type and desk setup."
  }
];

function parseDomain(url = "") {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
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

function trustReasonFor(item, sectionSlug) {
  if (item.source_type === "youtube") return "Exact product video used for visual fit, setup, or real-use context.";
  if (item.source_type === "reddit") return "Owner discussion used to catch fit, durability, reliability, or long-term tradeoffs.";
  if (item.source_type === "specs") return "Official specs used to verify product details, not to justify rank.";
  if (item.source_tier === "tier1") {
    if (sectionSlug === "outdoor") return "Specialist outdoor or running source with hands-on category testing.";
    if (sectionSlug === "remote-work") return "Hands-on office or ergonomics source with setup, comfort, or stability context.";
    if (sectionSlug === "lifestyle") return "Hands-on lifestyle or home source with clear product-specific testing.";
  }
  return "Supports the recommendation with product-specific context.";
}

function normalizeItem(item, category, product, index) {
  const sourceType = inferSourceType(item);
  const override = EXACT_SOURCE_OVERRIDES.find((entry) => (
    entry.category_slug === category.slug &&
    entry.product_name === product.name &&
    entry.source_type === sourceType
  ));
  if (override) {
    item = {
      ...item,
      ...override,
      checked_date: item.checked_date ?? item.verifiedAt ?? category.sourcesVerifiedAt ?? category.updated,
      verifiedAt: item.verifiedAt ?? item.checked_date ?? category.sourcesVerifiedAt ?? category.updated,
      is_public: true,
      is_exact_url: true
    };
  }
  const sourceTier = item.source_tier ?? sourceTierKey(item.tier);
  const exactPublicUrl = hasExactPublicUrl(item);
  const isGenericDiscovery = !exactPublicUrl || /corpus|sentiment sample|discovery/i.test(`${item.sourceName ?? ""} ${item.evidenceType ?? ""}`);
  const next = {
    ...item,
    source_type: sourceType,
    source_tier: sourceTier,
    title: item.title ?? item.sourceName ?? "Untitled source",
    publisher: item.publisher ?? item.sourceName ?? parseDomain(item.url),
    author: item.author ?? "",
    url: item.url ?? "",
    publish_date: item.publish_date ?? item.publishedAt ?? "",
    checked_date: item.checked_date ?? item.verifiedAt ?? category.sourcesVerifiedAt ?? category.updated,
    product_name: item.product_name ?? product.name,
    page_use_case: item.page_use_case ?? category.title,
    evidence_note: item.evidence_note ?? item.summary ?? "",
    trust_reason: item.trust_reason ?? trustReasonFor({ ...item, source_type: sourceType, source_tier: sourceTier }, category.sectionSlug),
    is_primary_source: item.is_primary_source ?? (sourceTier === "tier1" && ["expert", "youtube"].includes(sourceType) && exactPublicUrl && !isGenericDiscovery),
    display_order: item.display_order ?? ((SOURCE_DISPLAY_ORDER[sourceType] ?? 90) + index / 100),
    is_public: item.is_public ?? (exactPublicUrl && !isGenericDiscovery),
    is_exact_url: item.is_exact_url ?? exactPublicUrl
  };

  if (sourceType === "youtube") {
    next.video_id = item.video_id ?? parseYouTubeId(item.url);
    next.timestamp_start = item.timestamp_start ?? null;
    next.timestamp_label = item.timestamp_label ?? "Product discussion";
  }

  if (sourceType === "reddit") {
    next.subreddit = item.subreddit ?? parseRedditSubreddit(item.url);
    next.thread_type = item.thread_type ?? "post";
    next.permalink_type = item.permalink_type ?? (exactPublicUrl ? "exact_thread" : "search");
    next.discussion_quality = item.discussion_quality ?? ((item.sampleSize ?? 0) >= 20 ? "high" : (item.sampleSize ?? 0) >= 8 ? "medium" : "low");
  }

  return next;
}

const genericPublicAudit = [];

for (const category of categories) {
  for (const product of category.products ?? []) {
    product.evidence = (product.evidence ?? []).map((item, index) => {
      const next = normalizeItem(item, category, product, index);
      if (!next.is_public) {
        genericPublicAudit.push({
          category_slug: category.slug,
          section_slug: category.sectionSlug,
          product_name: product.name,
          source_type: next.source_type,
          publisher: next.publisher,
          current_url: next.url,
          reason: next.is_exact_url ? "Marked internal by governance rules." : "Needs an exact public URL before display.",
          suggested_next_step: next.source_type === "youtube"
            ? "Replace with an exact YouTube video URL and optional timestamp."
            : next.source_type === "reddit"
              ? "Replace with an exact Reddit thread or comment permalink."
              : "Review whether this should remain internal or become a public citation."
        });
      }
      return next;
    });
  }
}

writeFileSync(categoriesPath, `${JSON.stringify(categories, null, 2)}\n`, "utf8");
writeFileSync(auditPath, `${JSON.stringify({
  generated_at: new Date().toISOString(),
  purpose: "Tracks source records that are used internally but should not be shown publicly until they have exact, buyer-helpful URLs.",
  count: genericPublicAudit.length,
  items: genericPublicAudit
}, null, 2)}\n`, "utf8");

console.log(`Updated source schema in ${categoriesPath}`);
console.log(`Wrote ${genericPublicAudit.length} internal or generic source rows to ${auditPath}`);
