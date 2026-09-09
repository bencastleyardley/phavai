import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import ejs from "ejs";

const categories = [
  ...JSON.parse(readFileSync("data/categories.json", "utf8").replace(/^\uFEFF/, "")),
  ...readOptionalJson("data/roundup-additions.json", []),
  ...readOptionalJson("data/revenue-roundups.json", [])
];
const sections = JSON.parse(readFileSync("data/sections.json", "utf8").replace(/^\uFEFF/, ""));
const supportingPages = JSON.parse(readFileSync("data/supporting.json", "utf8").replace(/^\uFEFF/, ""));
const imageSources = JSON.parse(readFileSync("data/image-sources.json", "utf8").replace(/^\uFEFF/, ""));
const sourceGovernance = JSON.parse(readFileSync("data/source-governance.json", "utf8").replace(/^\uFEFF/, ""));
const affiliateOverrides = readOptionalJson("data/affiliate-overrides.json", []);
const commercialConfig = readOptionalJson("data/commercial-config.json", {});
const evidenceOverrides = readOptionalJson("data/youtube-evidence-overrides.json", []);
const todaysPicks = readOptionalJson("data/todays-picks.json", null);
const amazonCatalogCache = readOptionalJson(".cache/amazon-creators.json", null);
const productIntelligence = readOptionalJson("data/ai-opportunity-dashboard.json", null);
const maintenanceQueue = readOptionalJson("data/ai-maintenance-queue.json", null);
const runningHeadphoneSpecifications = readOptionalJson("data/running-headphone-specifications.json", null);
const dataLab = readOptionalJson("data/data-lab.json", null);
const gpsBatteryPlanner = readOptionalJson("data/gps-battery-planner.json", null);
const trailShoeMatrix = readOptionalJson("data/trail-shoe-matrix.json", null);
const relatedReviewOverrides = readOptionalJson("data/related-review-overrides.json", {});
const searchExperiments = readOptionalJson("data/search-experiments.json", { experiments: [] });
const editorialProfile = readOptionalJson("data/editorial-profile.json", {
  name: "Phavai Human Editor",
  id: "https://www.phavai.com/about.html",
  path: "/about.html",
  role: "Human editor",
  outdoorByline: "human outdoor editor",
  generalByline: "human editor",
  expertiseSections: []
});
const categoryTemplate = readFileSync("templates/category.ejs", "utf8");
const sectionTemplate = readFileSync("templates/section.ejs", "utf8");
const supportingTemplate = readFileSync("templates/supporting.ejs", "utf8");
const todaysPicksTemplate = readFileSync("templates/todays-picks.ejs", "utf8");
const operatorDashboardTemplate = readFileSync("templates/operator-dashboard.ejs", "utf8");
const specificationDatabaseTemplate = readFileSync("templates/spec-database.ejs", "utf8");
const dataLabTemplate = readFileSync("templates/data-lab.ejs", "utf8");
const gpsBatteryPlannerTemplate = readFileSync("templates/gps-battery-planner.ejs", "utf8");
const trailShoeMatrixTemplate = readFileSync("templates/trail-shoe-matrix.ejs", "utf8");

function readOptionalJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

function trimLineEndWhitespace(value) {
  return value.replace(/[ \t]+$/gm, "");
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const DEFAULT_MEASUREMENT_CONFIG = {
  ga4MeasurementId: "G-YD9YDB3YGT",
  bingSiteVerification: "2B9DC6FC5FA254DDA867340D39C066E1"
};
const ASSET_VERSION = "20260908d";

const analyticsConfig = {
  ga4MeasurementId: firstEnv("PHAVAI_GA4_MEASUREMENT_ID", "GA4_MEASUREMENT_ID", "GOOGLE_ANALYTICS_ID") || DEFAULT_MEASUREMENT_CONFIG.ga4MeasurementId,
  clarityProjectId: firstEnv("PHAVAI_CLARITY_PROJECT_ID", "CLARITY_PROJECT_ID", "MICROSOFT_CLARITY_PROJECT_ID"),
  googleSiteVerification: firstEnv("PHAVAI_GOOGLE_SITE_VERIFICATION", "GOOGLE_SITE_VERIFICATION"),
  bingSiteVerification: firstEnv("PHAVAI_BING_SITE_VERIFICATION", "BING_SITE_VERIFICATION") || DEFAULT_MEASUREMENT_CONFIG.bingSiteVerification
};

const AFFILIATE_CONFIG = {
  affiliateEnabled: configuredBool(commercialConfig.affiliateEnabled === true, "PHAVAI_AFFILIATE_ENABLED", "AFFILIATE_ENABLED", "AMAZON_AFFILIATE_ENABLED"),
  amazonTrackingId: firstEnv("PHAVAI_AMAZON_TRACKING_ID", "AMAZON_ASSOCIATE_TAG", "AMAZON_TRACKING_ID") || "phavai7311-20"
};

const AMAZON_CATALOG = activeAmazonCatalog(amazonCatalogCache);

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
    description: "Hands-on work reported by cited reviewers and category specialists."
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
  "best-comfortable-trail-running-shoes",
  "best-ultramarathon-fuel",
  "best-running-gels-for-ultramarathons",
  "best-electrolyte-mixes-for-ultrarunning",
  "best-walking-pads",
  "best-compression-boots-for-runners",
  "best-adjustable-dumbbells",
  "best-carb-drink-mixes-for-ultramarathons",
  "best-electrolytes-for-heavy-sweaters",
  "best-running-chews",
  "best-running-socks-for-long-runs",
  "best-running-sunglasses-for-sweat-and-bounce",
  "best-running-belts",
  "best-handheld-running-water-bottles",
  "best-laptop-stands-for-remote-work",
  "best-usb-c-hubs-for-remote-work",
  "best-portable-monitors-for-remote-work",
  "best-commuter-backpacks-for-men",
  "best-beard-trimmers",
  "best-electric-shavers-for-men",
  "best-body-groomers-for-men",
  "best-protein-bars",
  "best-creatine",
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
  [/sock/i, `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M24 10h16v17c0 8 7 9 10 14 4 7-1 13-10 13H22c-7 0-10-5-7-11 3-6 9-8 9-16V10Z"/><path d="M24 24h16M20 45h22"/></svg>`],
  [/sunglass|glasses/i, `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M10 32c5-4 14-5 22 0 8-5 17-4 22 0"/><path d="M12 34h18l-4 12H15l-3-12Zm22 0h18l-3 12H38l-4-12Z"/></svg>`],
  [/bottle|water/i, `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M25 9h14v10l5 7v24a6 6 0 0 1-6 6H26a6 6 0 0 1-6-6V26l5-7V9Z"/><path d="M25 18h14M22 34h20"/></svg>`],
  [/protein|bar|creatine|supplement/i, `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M18 16h28l6 8v24H12V24l6-8Z"/><path d="M18 16l-6 8m34-8 6 8M20 33h24M24 42h16"/></svg>`],
  [/belt/i, `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M10 34c9-10 35-10 44 0-7 8-37 8-44 0Z"/><path d="M28 27h8v14h-8zM14 35h10m16 0h10"/></svg>`],
  [/hub|usb/i, `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="18" y="18" width="28" height="28" rx="6"/><path d="M32 8v10m0 28v10M8 32h10m28 0h10M23 23h18M24 32h16M25 41h14"/></svg>`],
  [/shaver|groomer|trimmer/i, `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="22" y="10" width="20" height="44" rx="8"/><path d="M26 18h12M27 26h10M28 42h8"/><circle cx="32" cy="34" r="3"/></svg>`],
  [/headphone|earbud/i, `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M16 36V28a16 16 0 0 1 32 0v8"/><rect x="10" y="34" width="10" height="16" rx="5"/><rect x="44" y="34" width="10" height="16" rx="5"/></svg>`],
  [/watch|gps/i, `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="22" y="18" width="20" height="28" rx="8"/><path d="M26 18V8h12v10M26 46v10h12V46m-6-19v7l5 4"/></svg>`],
  [/hydration|vest|pack/i, `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M23 12h18l6 14v26H17V26l6-14Z"/><path d="M24 28h16M24 38h16M32 12v40"/></svg>`],
  [/pole/i, `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M24 8v48M40 8v48M18 18h12M34 18h12M20 56h8m8 0h8"/></svg>`],
  [/sandal|slide|recovery/i, `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M14 43c7-12 18-17 36-16 2 12-6 20-21 20-7 0-12-1-15-4Z"/><path d="M29 29c3 4 4 9 2 16"/></svg>`],
  [/gel|fuel|electrolyte|nutrition|food/i, `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M22 12h20l5 10v30H17V22l5-10Z"/><path d="M22 12h20M23 29h18M24 40h16"/></svg>`],
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
const SITE_LAST_MODIFIED = "2026-09-08";
const HOME_LAST_MODIFIED = "2026-09-08";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function firstEnv(...names) {
  return names.map((name) => process.env[name]).find((value) => value && value.trim())?.trim() ?? "";
}

function boolEnv(...names) {
  const value = firstEnv(...names).toLowerCase();
  return parseBoolValue(value);
}

function parseBoolValue(value = "") {
  return ["1", "true", "yes", "on", "enabled"].includes(String(value).toLowerCase());
}

function configuredBool(defaultValue, ...names) {
  const value = firstEnv(...names);
  return value ? parseBoolValue(value) : Boolean(defaultValue);
}

function toIsoDate(value) {
  if (!value) return SITE_LAST_MODIFIED;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return SITE_LAST_MODIFIED;
  return parsed.toISOString().slice(0, 10);
}

function conciseMetaDescription(value, maxLength = 158) {
  const copy = String(value || "").replace(/\s+/g, " ").trim();
  if (copy.length <= maxLength) return copy;
  const shortened = copy.slice(0, maxLength - 1).replace(/[,;:\s]+\S*$/, "").replace(/[,.!?;:]+$/, "");
  return `${shortened}…`;
}

function activeAmazonCatalog(cache) {
  if (!cache?.expiresAt || !Array.isArray(cache.items)) return new Map();
  if (new Date(cache.expiresAt).getTime() <= Date.now()) {
    console.warn("Amazon Creators API cache is stale; building with editorial links and brand-neutral illustrations.");
    return new Map();
  }
  return new Map(cache.items.filter((item) => item?.asin).map((item) => [String(item.asin).toUpperCase(), item]));
}

function asinFromAmazonUrl(value = "") {
  try {
    const url = new URL(value);
    if (!/(^|\.)amazon\.com$/i.test(url.hostname)) return "";
    return url.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:\/|$)/i)?.[1]?.toUpperCase() || "";
  } catch {
    return "";
  }
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

function productIconFor(product, category) {
  const haystack = [
    product.name,
    product.tag,
    product.bestFor,
    category.title,
    category.slug
  ].join(" ").toLowerCase();
  return REVIEW_ICON_RULES.find(([pattern]) => pattern.test(haystack))?.[1] ?? reviewIconFor(category);
}

function classToken(value = "standard") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "standard";
}

function poleVisualSvg(variant) {
  const common = `stroke="currentColor" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  const accent = `stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity=".36"`;
  const variants = {
    "folded-race": `<svg viewBox="0 0 120 120" aria-hidden="true"><path ${common} d="M31 26 88 94M87 26 31 94M43 42h34M43 78h34"/><path ${accent} d="M20 66h18M82 54h18M56 18l9 10-9 10"/><path ${common} d="M24 94h19m34 0h19"/></svg>`,
    "grip-control": `<svg viewBox="0 0 120 120" aria-hidden="true"><path ${common} d="M58 21v78"/><path ${common} d="M45 21h26l6 14-8 12H49l-8-12 4-14Z"/><path ${accent} d="M75 28c18 10 18 31 0 42M45 34c-16 9-16 25 0 34M50 100h20M41 87h34"/></svg>`,
    "durable-value": `<svg viewBox="0 0 120 120" aria-hidden="true"><path ${common} d="M44 20v80M76 20v80"/><path ${common} d="M35 38h18M67 38h18M35 68h18M67 68h18"/><path ${accent} d="M28 98h26M66 98h26M37 50h14M69 50h14"/></svg>`,
    "telescoping-adjust": `<svg viewBox="0 0 120 120" aria-hidden="true"><path ${common} d="M42 18v84M75 28v74"/><path ${common} d="M33 34h18M66 48h18M35 66h14M68 78h14"/><path ${accent} d="M26 90h32M60 90h32M42 18h22M75 28h18"/></svg>`
  };

  return variants[variant] ?? variants["folded-race"];
}

function silhouetteSvg(paths) {
  return `<svg viewBox="0 0 120 120" aria-hidden="true">${paths}</svg>`;
}

function footwearVisualSvg(variant) {
  const c = `stroke="currentColor" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  const a = `stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity=".35"`;
  const variants = {
    "max-cushion": silhouetteSvg(`<path ${c} d="M20 72c18 6 41-4 59-28l20 16c8 6 5 20-7 25H32c-13 0-19-5-12-13Z"/><path ${a} d="M31 86c19 8 45 9 74 2M48 57h34M42 68h47M66 43l8 12"/>`),
    "lugged": silhouetteSvg(`<path ${c} d="M17 70c20 2 41-8 61-34l23 18c8 7 4 19-8 24H30c-12 0-17-4-13-8Z"/><path ${a} d="M31 80l7 8m14-8 7 8m14-8 7 8m14-9 6 7M46 55h34M40 65h44"/>`),
    "race-curve": silhouetteSvg(`<path ${c} d="M18 74c25 1 47-13 66-42l16 22c6 8 1 18-10 21H31c-11 0-16 0-13-1Z"/><path ${a} d="M26 84c24 8 50 6 76-5M48 56h27M60 44l12 13M34 68c19 0 39-7 60-22"/>`),
    "wide-platform": silhouetteSvg(`<path ${c} d="M15 68c24 6 45-2 64-23l24 16c8 5 5 18-8 22H27c-12 0-18-6-12-15Z"/><path ${a} d="M24 85h78M39 59h48M37 69h56M72 45l10 11"/>`),
    "open-footbed": silhouetteSvg(`<path ${c} d="M25 72c13-20 33-31 61-30 6 21-10 39-39 41-12 1-19-3-22-11Z"/><path ${a} d="M45 45c10 8 14 20 10 36M30 70h36M72 48h13"/>`),
    "daily-trainer": silhouetteSvg(`<path ${c} d="M18 70c18 5 40-5 59-27l23 15c7 6 4 19-8 24H31c-12 0-18-5-13-12Z"/><path ${a} d="M34 82c20 5 42 5 64 0M45 57h35M40 67h43"/>`)
  };
  return variants[variant] ?? variants["daily-trainer"];
}

function watchVisualSvg(variant) {
  const c = `stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  const a = `stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity=".35"`;
  const variants = {
    endurance: silhouetteSvg(`<rect ${c} x="38" y="33" width="44" height="54" rx="18"/><path ${c} d="M45 33V15h30v18M45 87v18h30V87"/><path ${a} d="M53 58h14l-8 18M60 45v9l9 7"/>`),
    performance: silhouetteSvg(`<rect ${c} x="39" y="31" width="42" height="58" rx="16"/><path ${c} d="M48 31V14h24v17M48 89v17h24V89"/><path ${a} d="M52 67c9 8 22 3 24-9M49 51h22M60 42v14l10 6"/>`),
    compact: silhouetteSvg(`<rect ${c} x="43" y="35" width="34" height="48" rx="14"/><path ${c} d="M49 35V18h22v17M49 83v19h22V83"/><circle ${a} cx="60" cy="59" r="9"/>`),
    premium: silhouetteSvg(`<rect ${c} x="36" y="30" width="48" height="60" rx="18"/><path ${c} d="M45 30V13h30v17M45 90v17h30V90"/><path ${a} d="M47 48h26M47 73h26M60 43v16l12 8"/>`)
  };
  return variants[variant] ?? variants.endurance;
}

function hydrationVisualSvg(variant) {
  const c = `stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  const a = `stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity=".35"`;
  const variants = {
    vest: silhouetteSvg(`<path ${c} d="M42 18h36l11 28v52H31V46L42 18Z"/><path ${c} d="M49 18v80M71 18v80"/><path ${a} d="M47 48h26M47 66h26M36 42h13m22 0h13"/>`),
    pack: silhouetteSvg(`<path ${c} d="M40 18h40l12 24v58H28V42l12-24Z"/><path ${a} d="M42 44h36M42 64h36M60 18v82M31 38c-12 9-12 34 0 44M89 38c12 9 12 34 0 44"/>`),
    handheld: silhouetteSvg(`<rect ${c} x="42" y="21" width="36" height="78" rx="14"/><path ${c} d="M50 21V11h20v10"/><path ${a} d="M46 47h28M46 70h28M82 45c14 8 14 29 0 38"/>`),
    belt: silhouetteSvg(`<path ${c} d="M18 61c23-16 61-16 84 0"/><rect ${c} x="43" y="43" width="34" height="34" rx="10"/><path ${a} d="M30 67h20m20 0h20M53 52h14"/>`)
  };
  return variants[variant] ?? variants.vest;
}

function nutritionVisualSvg(variant) {
  const c = `stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  const a = `stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity=".35"`;
  const variants = {
    gel: silhouetteSvg(`<path ${c} d="M43 17h34l8 17-7 69H42l-7-69 8-17Z"/><path ${a} d="M43 17h34M41 40h38M44 70h32M49 88h22"/>`),
    bottle: silhouetteSvg(`<path ${c} d="M48 15h24v15l8 12v55c0 8-7 12-20 12s-20-4-20-12V42l8-12V15Z"/><path ${a} d="M49 15h22M45 52h30M45 78h30"/>`),
    tub: silhouetteSvg(`<path ${c} d="M34 33c0-10 52-10 52 0v58c0 10-52 10-52 0V33Z"/><path ${c} d="M34 33c0 10 52 10 52 0"/><path ${a} d="M43 55h34M43 73h34"/>`),
    bar: silhouetteSvg(`<path ${c} d="M32 35h56l-8 50H24l8-50Z"/><path ${a} d="M36 35l-8-12m52 12 8-12M36 55h40M32 72h42"/>`)
  };
  return variants[variant] ?? variants.gel;
}

function audioVisualSvg(variant) {
  const c = `stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  const a = `stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity=".35"`;
  const variants = {
    earbuds: silhouetteSvg(`<path ${c} d="M36 42c-10 0-18 8-18 18s8 18 18 18 18-8 18-18-8-18-18-18ZM84 42c-10 0-18 8-18 18s8 18 18 18 18-8 18-18-8-18-18-18Z"/><path ${a} d="M45 72v25M75 72v25M31 55h10m38 0h10"/>`),
    hook: silhouetteSvg(`<path ${c} d="M38 46c-11 0-20 9-20 20 0 9 6 16 14 19"/><path ${c} d="M82 46c11 0 20 9 20 20 0 9-6 16-14 19"/><circle ${c} cx="42" cy="66" r="13"/><circle ${c} cx="78" cy="66" r="13"/><path ${a} d="M55 34c9-7 21-7 30 0"/>`),
    band: silhouetteSvg(`<path ${c} d="M24 58c0-20 16-36 36-36s36 16 36 36"/><rect ${c} x="18" y="58" width="19" height="28" rx="9"/><rect ${c} x="83" y="58" width="19" height="28" rx="9"/><path ${a} d="M45 30c9-4 21-4 30 0"/>`),
    sealed: silhouetteSvg(`<path ${c} d="M39 39c-12 0-22 10-22 22s10 22 22 22 22-10 22-22-10-22-22-22ZM81 39c12 0 22 10 22 22S93 83 81 83 59 73 59 61s10-22 22-22Z"/><path ${a} d="M35 58h8m34 0h8M49 77l-5 21M71 77l5 21"/>`)
  };
  return variants[variant] ?? variants.earbuds;
}

function workspaceVisualSvg(variant) {
  const c = `stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  const a = `stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity=".35"`;
  const variants = {
    desk: silhouetteSvg(`<path ${c} d="M16 50h88M28 50v50m64-50v50M42 25h36v25"/><path ${a} d="M42 70h36M48 25V14h24v11"/>`),
    chair: silhouetteSvg(`<path ${c} d="M42 18h36l5 50H37l5-50ZM30 68h60v16H30zM60 84v22m-24 0h48"/><path ${a} d="M46 34h28M45 50h30"/>`),
    webcam: silhouetteSvg(`<rect ${c} x="28" y="25" width="64" height="43" rx="17"/><circle ${c} cx="60" cy="46" r="11"/><path ${a} d="M46 89h28M60 68v21M39 46h6m30 0h6"/>`),
    keyboard: silhouetteSvg(`<path ${c} d="M18 43c27-13 57-13 84 0v42H18V43Z"/><path ${a} d="M31 58h8m12 0h8m12 0h8m12 0h8M31 72h58"/>`),
    arm: silhouetteSvg(`<rect ${c} x="16" y="20" width="54" height="35" rx="8"/><path ${c} d="M70 38h18v50H50m-9-33v20"/><path ${a} d="M24 30h38M31 94h38"/>`),
    mat: silhouetteSvg(`<rect ${c} x="18" y="35" width="84" height="50" rx="10"/><path ${a} d="M33 51h54M33 66h39"/>`)
  };
  return variants[variant] ?? variants.desk;
}

function travelVisualSvg(variant) {
  const c = `stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  const a = `stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity=".35"`;
  const variants = {
    suitcase: silhouetteSvg(`<rect ${c} x="38" y="25" width="44" height="68" rx="12"/><path ${c} d="M49 25V14h22v11M46 93v10m28-10v10"/><path ${a} d="M52 40h16M52 56h16M52 72h16"/>`),
    backpack: silhouetteSvg(`<path ${c} d="M39 23h42l10 24v49H29V47l10-24Z"/><path ${a} d="M42 48h36M42 69h36M33 45c-13 12-13 32 0 44M87 45c13 12 13 32 0 44"/>`),
    soft: silhouetteSvg(`<path ${c} d="M30 35h60l8 47c2 12-6 19-22 19H44c-16 0-24-7-22-19l8-47Z"/><path ${c} d="M46 35V20h28v15"/><path ${a} d="M40 55h40M38 74h44"/>`),
    cube: silhouetteSvg(`<path ${c} d="M29 36h62v50H29z"/><path ${a} d="M29 52h62M45 36v50M75 36v50M39 25h42"/>`)
  };
  return variants[variant] ?? variants.suitcase;
}

function coffeeVisualSvg(variant) {
  const c = `stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  const a = `stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity=".35"`;
  const variants = {
    drip: silhouetteSvg(`<path ${c} d="M37 23h46v36c0 18-10 31-23 31S37 77 37 59V23Z"/><path ${c} d="M83 45h8c10 0 10 22 0 22h-8"/><path ${a} d="M46 36h28M48 58h24M50 102h20"/>`),
    espresso: silhouetteSvg(`<path ${c} d="M36 30h48v32c0 14-9 23-24 23s-24-9-24-23V30Z"/><path ${c} d="M84 42h9c9 0 9 20 0 20h-9M45 85v17m30-17v17"/><path ${a} d="M48 44h24M52 61h16"/>`),
    kettle: silhouetteSvg(`<path ${c} d="M33 44c0-14 12-25 27-25s27 11 27 25v33c0 14-12 24-27 24S33 91 33 77V44Z"/><path ${c} d="M87 48c15 4 19 18 3 27M36 46 21 39"/><path ${a} d="M50 19V9h20v10M47 61h26"/>`)
  };
  return variants[variant] ?? variants.drip;
}

function recoveryVisualSvg(variant) {
  const c = `stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  const a = `stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity=".35"`;
  const variants = {
    massage: silhouetteSvg(`<rect ${c} x="48" y="17" width="28" height="48" rx="13" transform="rotate(32 62 41)"/><path ${c} d="M48 58 28 93m47-67 18-16M79 69l15 18"/><path ${a} d="M38 76h21M84 28c9 8 14 17 15 27"/>`),
    roller: silhouetteSvg(`<rect ${c} x="28" y="35" width="64" height="50" rx="20"/><path ${a} d="M40 45v30M55 39v42M70 39v42M85 45v30"/>`),
    compression: silhouetteSvg(`<path ${c} d="M43 18h34l9 76c1 8-7 12-26 12s-27-4-26-12l9-76Z"/><path ${a} d="M44 42h32M42 64h36M39 86h42"/>`)
  };
  return variants[variant] ?? variants.massage;
}

function airVisualSvg(variant) {
  const c = `stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  const a = `stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity=".35"`;
  const variants = {
    tower: silhouetteSvg(`<rect ${c} x="42" y="15" width="36" height="90" rx="16"/><path ${a} d="M51 34h18M51 50h18M51 66h18M51 82h18"/><circle ${a} cx="60" cy="94" r="3"/>`),
    box: silhouetteSvg(`<rect ${c} x="30" y="23" width="60" height="78" rx="14"/><path ${a} d="M43 42h34M43 58h34M43 74h34M42 90h36"/>`),
    cylinder: silhouetteSvg(`<path ${c} d="M38 31c0-12 44-12 44 0v60c0 12-44 12-44 0V31Z"/><path ${c} d="M38 31c0 12 44 12 44 0"/><path ${a} d="M48 52h24M48 68h24M48 84h24"/>`)
  };
  return variants[variant] ?? variants.tower;
}

function productSilhouetteSvg(kind, variant, fallbackSvg) {
  if (kind === "poles") return poleVisualSvg(variant);
  if (kind === "footwear") return footwearVisualSvg(variant);
  if (kind === "watch") return watchVisualSvg(variant);
  if (kind === "hydration") return hydrationVisualSvg(variant);
  if (kind === "nutrition") return nutritionVisualSvg(variant);
  if (kind === "audio") return audioVisualSvg(variant);
  if (kind === "workspace") return workspaceVisualSvg(variant);
  if (kind === "travel") return travelVisualSvg(variant);
  if (kind === "coffee") return coffeeVisualSvg(variant);
  if (kind === "recovery") return recoveryVisualSvg(variant);
  if (kind === "air") return airVisualSvg(variant);
  return fallbackSvg;
}

function visualKindForProduct(product, category) {
  const haystack = [
    product.name,
    product.tag,
    product.bestFor,
    ...(product.specs ?? []),
    category.title,
    category.slug
  ].join(" ").toLowerCase();
  if (/pole/.test(haystack)) return "poles";
  if (/shoe|trainer|sandal|slide/.test(haystack)) return "footwear";
  if (/watch|gps/.test(haystack)) return "watch";
  if (/gel|fuel|electrolyte|nutrition|food|waffle|drink mix|tailwind|maurten|gu energy|precision fuel/.test(haystack)) return "nutrition";
  if (/headphone|earbud/.test(haystack)) return "audio";
  if (/desk|chair|keyboard|webcam|monitor|mat/.test(haystack)) return "workspace";
  if (/luggage|carry-on/.test(haystack)) return "travel";
  if (/hydration|vest|pack|bottle|flask|belt/.test(haystack)) return "hydration";
  if (/coffee/.test(haystack)) return "coffee";
  if (/massage|recovery|foam/.test(haystack)) return "recovery";
  if (/purifier|air/.test(haystack)) return "air";
  return classToken(category.sectionSlug || category.slug);
}

function visualVariantForProduct(product, category, decisionTags = []) {
  const haystack = [
    product.name,
    product.tag,
    product.bestFor,
    ...(product.specs ?? []),
    ...(product.pros ?? []),
    category.title,
    category.slug
  ].join(" ").toLowerCase();

  if (/pole/.test(haystack)) {
    if (/adjustable|telescoping|gossamer|fastpack/.test(haystack)) return "telescoping-adjust";
    if (/shark|grip system|leki|control/.test(haystack)) return "grip-control";
    if (/aluminum|durable value|distance z|durable/.test(haystack)) return "durable-value";
    if (/race-day|carbon z|very light|fast to deploy|low weight/.test(haystack)) return "folded-race";
    return "folded-race";
  }

  if (/shoe|trainer|sandal|slide/.test(haystack)) {
    if (/sandal|slide/.test(haystack)) return "open-footbed";
    if (/wide|roomy|toe box/.test(haystack)) return "wide-platform";
    if (/mud|technical|rocky|grip|lug|wet/.test(haystack)) return "lugged";
    if (/super shoe|carbon|race|racing|marathon racing|fast/.test(haystack)) return "race-curve";
    if (/comfort|cushion|max|soft|heavy runner|plantar|recovery/.test(haystack)) return "max-cushion";
    return "daily-trainer";
  }

  if (/watch|gps/.test(haystack)) {
    if (/ultra|battery|100|epix|fenix|endurance/.test(haystack)) return "endurance";
    if (/pace|race|performance|fast|forerunner/.test(haystack)) return "performance";
    if (/small|beginner|first/.test(haystack)) return "compact";
    return "premium";
  }

  if (/gel|fuel|electrolyte|nutrition|food/.test(haystack)) {
    if (/electrolyte|mix|drink/.test(haystack)) return "tub";
    if (/bottle|liquid/.test(haystack)) return "bottle";
    if (/bar|food/.test(haystack)) return "bar";
    return "gel";
  }

  if (/hydration|vest|pack|bottle|belt/.test(haystack)) {
    if (/vest/.test(haystack)) return "vest";
    if (/handheld|bottle|flask/.test(haystack)) return "handheld";
    if (/belt/.test(haystack)) return "belt";
    return "pack";
  }

  if (/headphone|earbud/.test(haystack)) {
    if (/small ear|earbud|buds/.test(haystack)) return "earbuds";
    if (/rain|secure|hook|running/.test(haystack)) return "hook";
    if (/noise|call|remote|office/.test(haystack)) return "band";
    return "sealed";
  }

  if (/desk|chair|keyboard|webcam|monitor|mat/.test(haystack)) {
    if (/chair/.test(haystack)) return "chair";
    if (/webcam|camera/.test(haystack)) return "webcam";
    if (/keyboard/.test(haystack)) return "keyboard";
    if (/monitor arm|arm/.test(haystack)) return "arm";
    if (/mat/.test(haystack)) return "mat";
    return "desk";
  }

  if (/luggage|carry-on|backpack|bag|cube/.test(haystack)) {
    if (/backpack/.test(haystack)) return "backpack";
    if (/soft|weekender|bag/.test(haystack)) return "soft";
    if (/cube|packing/.test(haystack)) return "cube";
    return "suitcase";
  }

  if (/coffee|kettle|espresso/.test(haystack)) {
    if (/espresso/.test(haystack)) return "espresso";
    if (/kettle|pour over/.test(haystack)) return "kettle";
    return "drip";
  }

  if (/massage|recovery|foam|compression/.test(haystack)) {
    if (/foam|roller/.test(haystack)) return "roller";
    if (/compression|boot/.test(haystack)) return "compression";
    return "massage";
  }

  if (/purifier|air/.test(haystack)) {
    if (/bedroom|small/.test(haystack)) return "tower";
    if (/pet|large/.test(haystack)) return "box";
    return "cylinder";
  }

  if (decisionTags.includes("performance")) return "performance";
  if (decisionTags.includes("comfort")) return "comfort";
  if (decisionTags.includes("distance")) return "endurance";
  if (decisionTags.includes("budget")) return "value";
  if (decisionTags.includes("durability")) return "durable";
  if (decisionTags.includes("small-space")) return "compact";
  if (decisionTags.includes("quiet")) return "quiet";
  if (decisionTags.includes("premium")) return "premium";
  return "balanced";
}

function visualAttributesForProduct(product, decisionTags = []) {
  const specHaystack = [
    product.name,
    product.tag,
    product.bestFor,
    ...(product.specs ?? [])
  ].join(" ").toLowerCase();
  const evidenceHaystack = [
    specHaystack,
    ...(product.pros ?? [])
  ].join(" ").toLowerCase();

  const attributes = [];
  const add = (label) => {
    if (!attributes.includes(label)) attributes.push(label);
  };

  if (/z-fold|folding|folded/.test(specHaystack)) add("Folding");
  if (/fixed length/.test(specHaystack)) add("Fixed");
  if (/adjustable|telescoping/.test(specHaystack)) add("Adjustable");
  if (/carbon/.test(specHaystack)) add("Carbon");
  if (/aluminum/.test(specHaystack)) add("Durable");
  if (/shark|grip system|secure grip|control/.test(evidenceHaystack)) add("Grip");
  if (/race|race-focused|race-day|fast to deploy|superlite/.test(evidenceHaystack)) add("Race");
  if (/value|price|budget|affordable/.test(specHaystack) || decisionTags.includes("budget")) add("Value");
  if (decisionTags.includes("comfort")) add("Comfort");
  if (decisionTags.includes("distance")) add("Distance");
  if (decisionTags.includes("small-space")) add("Compact");
  if (decisionTags.includes("quiet")) add("Quiet");

  return attributes.slice(0, 4);
}

function visualProfileForProduct(product, category, decisionTags = []) {
  const kind = visualKindForProduct(product, category);
  const variant = visualVariantForProduct(product, category, decisionTags);
  const fallbackSvg = productIconFor(product, category);

  return {
    kind,
    variant,
    role: cleanSnippet(product.tag || product.bestFor || "Product role", 48),
    attributes: visualAttributesForProduct(product, decisionTags),
    svg: productSilhouetteSvg(kind, variant, fallbackSvg)
  };
}

function cleanSnippet(value = "", maxLength = 150) {
  const text = String(value).replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  const sentenceBoundary = Math.max(
    text.lastIndexOf(".", maxLength - 1),
    text.lastIndexOf(";", maxLength - 1)
  );
  if (sentenceBoundary >= Math.min(54, maxLength - 28)) {
    return text.slice(0, sentenceBoundary + 1).trim();
  }

  const clauseBoundary = Math.max(
    text.lastIndexOf(",", maxLength - 1),
    text.lastIndexOf(";", maxLength - 1),
    text.lastIndexOf(" - ", maxLength - 1),
    text.lastIndexOf(" – ", maxLength - 1)
  );
  if (clauseBoundary >= Math.min(54, maxLength - 34)) {
    return `${text.slice(0, clauseBoundary).replace(/[\s,;:-]+$/, "").trim()}.`;
  }

  let trimmed = text
    .slice(0, maxLength - 1)
    .replace(/\s+\S*$/, "")
    .trim();
  while (/\b(a|an|the|and|or|but|that|who|for|to|of|at|by|if|as|is|are|was|were|be|been|being|not|this|it|on|from|into|onto|around|about|over|under|through|without|because|while)$/i.test(trimmed)) {
    trimmed = trimmed.replace(/\s+\S+$/, "").trim();
  }
  return `${trimmed}.`;
}

function humanList(items = []) {
  const cleanItems = items.filter(Boolean);
  if (cleanItems.length <= 1) return cleanItems[0] ?? "";
  if (cleanItems.length === 2) return `${cleanItems[0]} and ${cleanItems[1]}`;
  return `${cleanItems.slice(0, -1).join(", ")}, and ${cleanItems.at(-1)}`;
}

function polishBuyerCopy(value = "") {
  return String(value)
    .replace(/\bsource agreement and evidence depth\b/gi, "how closely the best reviews line up and how strong the proof is")
    .replace(/\breview agreement and evidence depth\b/gi, "how closely the best reviews line up and how strong the proof is")
    .replace(/\bsource agreement\b/gi, "how closely the best reviews line up")
    .replace(/\bsource-agreement\b/gi, "how closely the best reviews line up")
    .replace(/\breview agreement\b/gi, "how closely the best reviews line up")
    .replace(/\bevidence depth\b/gi, "strength of the proof")
    .replace(/\bsource mix\b/gi, "review set")
    .replace(/\bcorpus\b/gi, "set")
    .replace(/\bsentiment\b/gi, "feedback")
    .replace(/\bAI confidence\b/gi, "evidence confidence")
    .replace(/,\s*with tradeoffs worth weighing\.?/gi, ".")
    .replace(/\bcredible ([a-z -]+?) contender\b/gi, "serious $1 option")
    .replace(/\bcredible contender\b/gi, "serious option")
    .replace(/\bfor shoppers who want ([^.]*?) who want\b/gi, "for $1 buyers who need")
    .replace(/\bfor shoppers who want ([^.]*?) that want\b/gi, "for buyers who want $1 and need")
    .replace(/\bfor shoppers buyers who need\b/gi, "for buyers who need")
    .replace(/\bfor runners who want runners who want\b/gi, "for runners who want")
    .replace(/\s+/g, " ")
    .trim();
}

function firstUsefulLine(values = [], fallback = "") {
  return cleanSnippet(polishBuyerCopy(values.find((value) => typeof value === "string" && value.trim()) || fallback));
}

const DECISION_TAG_RULES = [
  ["comfort", ["comfort", "cushion", "soft", "plush", "ergonomic", "back pain", "neck pain", "recovery", "side sleeper", "stable ride"]],
  ["performance", ["performance", "fast", "race", "racing", "carbon", "technical", "grip", "precision", "pro", "speed", "responsive"]],
  ["distance", ["distance", "long", "ultra", "ultrarunning", "marathon", "100 mile", "100k", "hydration", "battery", "training", "all-day"]],
  ["beginner", ["beginner", "first", "easy", "simple", "daily", "starter", "approachable", "safe", "for most"]],
  ["budget", ["value", "budget", "affordable", "sale", "under", "price", "cost", "reasonable"]],
  ["premium", ["premium", "best overall", "elite", "flagship", "high-end", "top-tier", "luxury"]],
  ["small-space", ["small", "compact", "apartment", "portable", "carry-on", "personal item", "under-seat", "desk setup", "small kitchen"]],
  ["quiet", ["quiet", "noise", "low light", "bedroom", "sleep", "white noise", "calls", "focus"]],
  ["everyday", ["everyday", "daily", "commuting", "home", "office", "travel", "routine", "easy living"]],
  ["wide-fit", ["wide", "roomy", "toe box", "broad", "high volume"]],
  ["durability", ["durable", "durability", "protective", "rugged", "stable", "supportive", "long-term"]]
];

function productHaystack(product, category) {
  return [
    category.title,
    category.section?.title,
    product.name,
    product.tag,
    product.verdict,
    product.bestFor,
    product.avoidIf,
    ...(product.specs ?? []),
    ...(product.pros ?? []),
    ...(product.cons ?? []),
    ...(product.positiveThemes ?? []),
    ...(product.cautionThemes ?? [])
  ].join(" ").toLowerCase();
}

function productPositiveHaystack(product) {
  return [
    product.name,
    product.tag,
    product.verdict,
    product.bestFor,
    ...(product.specs ?? []),
    ...(product.pros ?? []),
    ...(product.positiveThemes ?? [])
  ].join(" ").toLowerCase();
}

function decisionTagsForProduct(product, category) {
  // Fit badges must only come from positive product claims. Mixing in avoid-if,
  // cons, or caution text can turn "not for wide feet" into a wide-fit signal.
  const haystack = productPositiveHaystack(product);
  const tags = DECISION_TAG_RULES
    .filter(([, terms]) => terms.some((term) => haystack.includes(term)))
    .map(([tag]) => tag);
  const beginnerPositiveText = [
    product.tag,
    product.bestFor,
    product.verdict,
    ...(product.pros ?? []),
    ...(product.positiveThemes ?? [])
  ].join(" ").toLowerCase();
  const beginnerAvoidText = [
    product.avoidIf,
    ...(product.cons ?? []),
    ...(product.cautionThemes ?? [])
  ].join(" ").toLowerCase();
  const positiveBeginnerSignal = /beginner|first|starter|approachable|easygoing|new runner|new trail/.test(beginnerPositiveText);
  const negativeBeginnerSignal = /beginner|first trail|newer runner|new runner|starter/.test(beginnerAvoidText);

  if (category.sectionSlug === "outdoor") {
    if (/shoe|sandal|slide|recovery|massage|foam/.test(haystack)) tags.push("comfort");
    if (/watch|hydration|vest|marathon|ultra|100k|100 mile|fuel|gel|electrolyte/.test(haystack)) tags.push("distance");
    if (/technical|mud|grip|race|carbon|pole|trail/.test(haystack)) tags.push("performance");
    if (positiveBeginnerSignal && !negativeBeginnerSignal) tags.push("beginner");
  }

  if (category.sectionSlug === "remote-work") {
    if (/chair|keyboard|desk mat|footrest|ergonomic|back|wrist/.test(haystack)) tags.push("comfort");
    if (/standing desk|desk|monitor arm|webcam|lamp|small|compact|apartment/.test(haystack)) tags.push("small-space");
    if (/webcam|microphone|headphone|call|zoom|noise|focus|low light/.test(haystack)) tags.push("quiet");
    if (/value|budget|affordable|under/.test(haystack)) tags.push("budget");
  }

  if (category.sectionSlug === "lifestyle") {
    if (/carry-on|luggage|travel|personal item|portable|small|apartment/.test(haystack)) tags.push("small-space");
    if (/air purifier|bedroom|quiet|noise|sleep/.test(haystack)) tags.push("quiet");
    if (/coffee|air purifier|massage|luggage|daily|everyday|home/.test(haystack)) tags.push("everyday");
    if (/premium|espresso|pro|top-tier/.test(haystack)) tags.push("premium");
  }

  const cleanedTags = [...new Set(tags)].filter((tag) => tag !== "beginner" || (positiveBeginnerSignal && !negativeBeginnerSignal));
  if (!cleanedTags.length) cleanedTags.push("everyday");
  return cleanedTags.slice(0, 6);
}

const ATTRIBUTE_LABELS = {
  comfort: "Comfort",
  cushioning: "Cushioning",
  stability: "Stability",
  durability: "Long-term build",
  grip: "Grip",
  traction: "Traction",
  lightweight: "Light feel",
  value: "Price fit",
  fitWidth: "Fit room",
  terrainSuitability: "Terrain range",
  distanceSuitability: "Long-distance fit",
  beginnerFriendliness: "Beginner ease",
  raceFocus: "Race focus",
  dailyVersatility: "Daily versatility",
  recoveryFriendliness: "Recovery fit",
  ergonomics: "Ergonomics",
  adjustability: "Adjustability",
  smallSpace: "Small-space fit",
  quietUse: "Quiet use",
  portability: "Portability",
  easeOfUse: "Ease of use",
  premiumBuild: "Premium build",
  clarity: "Call clarity",
  packability: "Packability",
  airCleaning: "Air cleaning",
  flavorTolerance: "Flavor tolerance"
};

const ATTRIBUTE_TERM_RULES = {
  comfort: {
    positive: ["comfort", "comfortable", "soft", "plush", "forgiving", "easy", "recovery", "ergonomic", "supportive", "stable ride", "cushion"],
    negative: ["firm", "harsh", "stiff", "hotspot", "rubbing", "uncomfortable"]
  },
  cushioning: {
    positive: ["cushion", "max cushion", "protective", "soft", "plush", "absorbs", "long miles", "underfoot"],
    negative: ["minimal", "low stack", "ground feel", "firm"]
  },
  stability: {
    positive: ["stable", "stability", "supportive", "secure", "controlled", "planted", "wide base", "confidence"],
    negative: ["unstable", "wobbly", "sloppy", "tippy", "ankle roll"]
  },
  durability: {
    positive: ["durable", "durability", "rugged", "protective", "long-term", "reinforced", "reliable", "built", "heavy-duty"],
    negative: ["wear", "delaminate", "fragile", "short lifespan", "break", "tear"]
  },
  grip: {
    positive: ["grip", "lug", "vibram", "sticky", "bite", "traction", "mud", "wet rock", "technical"],
    negative: ["slick", "slip", "poor grip"]
  },
  traction: {
    positive: ["traction", "grip", "lug", "mud", "technical", "rocky", "wet", "loose dirt", "bite"],
    negative: ["slick", "road", "smooth outsole"]
  },
  lightweight: {
    positive: ["light", "lightweight", "superlite", "carbon", "nimble", "fast", "race", "portable"],
    negative: ["heavy", "bulky", "substantial"]
  },
  value: {
    positive: ["value", "budget", "affordable", "price", "under", "reasonable", "sale", "durable value"],
    negative: ["expensive", "premium price", "high price", "costly"]
  },
  fitWidth: {
    positive: ["wide", "roomy", "toe box", "broad", "high volume", "wide feet"],
    negative: ["narrow", "tight", "low volume", "pointy", "pinch"]
  },
  terrainSuitability: {
    positive: ["technical", "rocky", "mud", "mixed terrain", "trail", "mountain", "loose", "wet", "fastpacking"],
    negative: ["road-only", "smooth path"]
  },
  distanceSuitability: {
    positive: ["long", "ultra", "ultrarunning", "100 mile", "100k", "marathon", "distance", "all-day", "battery", "training"],
    negative: ["short", "5k", "short-to-mid"]
  },
  beginnerFriendliness: {
    positive: ["beginner", "first", "easy", "simple", "approachable", "safe", "daily", "for most", "starter"],
    negative: ["expert", "aggressive", "race-only", "specialized"]
  },
  raceFocus: {
    positive: ["race", "racing", "performance", "fast", "carbon", "superlite", "pro", "speed", "responsive", "tempo"],
    negative: ["daily", "cruiser", "mellow"]
  },
  dailyVersatility: {
    positive: ["daily", "versatile", "all-rounder", "mixed", "everyday", "routine", "commuting", "one shoe", "for most"],
    negative: ["specialized", "race-only", "narrow use"]
  },
  recoveryFriendliness: {
    positive: ["recovery", "sore", "calf", "massage", "foam", "slide", "sandal", "relief"],
    negative: ["aggressive", "firm"]
  },
  ergonomics: {
    positive: ["ergonomic", "back", "wrist", "posture", "lumbar", "support", "adjustable", "comfort"],
    negative: ["limited adjustment", "poor support"]
  },
  adjustability: {
    positive: ["adjustable", "range", "height", "fit", "custom", "tunable", "arm", "tilt"],
    negative: ["fixed", "limited"]
  },
  smallSpace: {
    positive: ["small", "compact", "apartment", "portable", "under-seat", "small kitchen", "small spaces", "desk setup"],
    negative: ["large footprint", "bulky"]
  },
  quietUse: {
    positive: ["quiet", "low noise", "focus", "calls", "bedroom", "sleep", "low light", "noise-cancel"],
    negative: ["loud", "noisy"]
  },
  portability: {
    positive: ["portable", "carry-on", "travel", "light", "packable", "weekender", "handheld", "under-seat"],
    negative: ["bulky", "heavy"]
  },
  easeOfUse: {
    positive: ["easy", "simple", "plug-and-play", "beginner", "starter", "approachable", "daily"],
    negative: ["fussy", "complex", "learning curve"]
  },
  premiumBuild: {
    positive: ["premium", "flagship", "elite", "pro", "top-tier", "high-end", "refined"],
    negative: ["basic", "entry-level"]
  },
  clarity: {
    positive: ["clarity", "clear", "webcam", "microphone", "zoom", "calls", "low light", "focus"],
    negative: ["grainy", "muffled"]
  },
  packability: {
    positive: ["packing", "packable", "cube", "carry-on", "travel", "organize", "compression"],
    negative: ["hard to pack", "bulky"]
  },
  airCleaning: {
    positive: ["air purifier", "hepa", "pet hair", "bedroom", "dust", "allergy", "clean air"],
    negative: ["filter cost", "noise"]
  },
  flavorTolerance: {
    positive: ["flavor", "taste", "easy stomach", "digest", "electrolyte", "gel", "fuel", "mix"],
    negative: ["too sweet", "stomach", "sticky", "aftertaste"]
  }
};

const SECTION_ATTRIBUTE_KEYS = {
  outdoor: ["comfort", "cushioning", "stability", "durability", "grip", "traction", "lightweight", "value", "fitWidth", "terrainSuitability", "distanceSuitability", "beginnerFriendliness", "raceFocus", "dailyVersatility", "recoveryFriendliness", "flavorTolerance", "adjustability", "easeOfUse"],
  "remote-work": ["comfort", "ergonomics", "adjustability", "durability", "value", "smallSpace", "quietUse", "clarity", "easeOfUse", "dailyVersatility", "stability", "premiumBuild"],
  lifestyle: ["dailyVersatility", "value", "smallSpace", "quietUse", "portability", "durability", "easeOfUse", "premiumBuild", "packability", "airCleaning", "flavorTolerance", "comfort", "stability"]
};

const CATEGORY_DECISION_OPTIONS = {
  "best-mens-trail-running-shoes": [
    { key: "comfort", label: "Comfort first", help: "Protective cushion and easier long-run feel.", weights: { comfort: 1, cushioning: 0.85, stability: 0.45, distanceSuitability: 0.35 } },
    { key: "technical", label: "Technical trails", help: "Grip, precision, and control on rough terrain.", weights: { grip: 1, traction: 0.95, terrainSuitability: 0.85, stability: 0.55 } },
    { key: "wide-fit", label: "Roomier fit", help: "Better odds for broad or high-volume feet.", weights: { fitWidth: 1, comfort: 0.45, stability: 0.25 } },
    { key: "race", label: "Race-day speed", help: "Fast, light, and performance-leaning.", weights: { raceFocus: 1, lightweight: 0.85, traction: 0.45 } }
  ],
  "best-womens-trail-running-shoes": [
    { key: "comfort", label: "Comfort first", help: "Protective cushion and stable descending.", weights: { comfort: 1, cushioning: 0.85, stability: 0.55 } },
    { key: "technical", label: "Technical trails", help: "Traction and control when the trail gets messy.", weights: { grip: 1, traction: 0.95, terrainSuitability: 0.85 } },
    { key: "daily", label: "Daily trail miles", help: "Versatile shoes that do not feel too specialized.", weights: { dailyVersatility: 1, comfort: 0.55, durability: 0.35 } },
    { key: "race", label: "Race-day speed", help: "Light, responsive, and performance-oriented.", weights: { raceFocus: 1, lightweight: 0.85, traction: 0.45 } }
  ],
  "best-trail-running-poles": [
    { key: "race", label: "Race-day light", help: "Fast deployment and low carried weight.", weights: { raceFocus: 1, lightweight: 1, easeOfUse: 0.35 } },
    { key: "grip", label: "Grip/control", help: "Secure hand feel for climbs and descents.", weights: { grip: 1, stability: 0.75, durability: 0.35 } },
    { key: "durable", label: "Durable value", help: "More confidence for frequent training use.", weights: { durability: 1, value: 0.75, stability: 0.4 } },
    { key: "adjustable", label: "Adjustability", help: "Better fit flexibility across terrain.", weights: { adjustability: 1, easeOfUse: 0.45, durability: 0.25 } }
  ],
  "best-standing-desks": [
    { key: "ergonomic", label: "Ergonomic range", help: "Stable height range and smoother adjustment.", weights: { ergonomics: 1, adjustability: 0.95, stability: 0.45 } },
    { key: "small-space", label: "Small space", help: "Cleaner fit in apartments and tighter rooms.", weights: { smallSpace: 1, easeOfUse: 0.45, value: 0.35 } },
    { key: "durable", label: "Built to last", help: "Stability and durability matter most.", weights: { durability: 1, stability: 0.85, premiumBuild: 0.35 } },
    { key: "value", label: "Lower price", help: "Useful features without overbuying.", weights: { value: 1, durability: 0.55, easeOfUse: 0.35 } }
  ],
  "best-carry-on-luggage": [
    { key: "airline", label: "Airline friendly", help: "Portable sizing and easy overhead-bin handling.", weights: { portability: 1, smallSpace: 0.85, packability: 0.45 } },
    { key: "durable", label: "Built to last", help: "Shell, wheels, and handle confidence.", weights: { durability: 1, stability: 0.45, premiumBuild: 0.35 } },
    { key: "packing", label: "Easy packing", help: "Organization and usable interior space.", weights: { packability: 1, easeOfUse: 0.65, dailyVersatility: 0.35 } },
    { key: "value", label: "Lower price", help: "Strong ownership case for the price.", weights: { value: 1, durability: 0.55, easeOfUse: 0.35 } }
  ]
};

const SECTION_DECISION_OPTIONS = {
  outdoor: [
    { key: "comfort", label: "Comfort first", help: "A forgiving pick that is easier to live with.", weights: { comfort: 1, cushioning: 0.7, stability: 0.35 } },
    { key: "distance", label: "Long days", help: "Built around distance, durability, and fewer surprises.", weights: { distanceSuitability: 1, durability: 0.65, comfort: 0.45 } },
    { key: "performance", label: "Performance", help: "Prioritizes speed, grip, and a lighter feel.", weights: { raceFocus: 1, lightweight: 0.75, traction: 0.5 } },
    { key: "value", label: "Lower price", help: "Strong fit without overpaying.", weights: { value: 1, durability: 0.45, dailyVersatility: 0.35 } }
  ],
  "remote-work": [
    { key: "ergonomic", label: "Ergonomic comfort", help: "Support, adjustability, and all-day use.", weights: { ergonomics: 1, comfort: 0.85, adjustability: 0.55 } },
    { key: "small-space", label: "Small space", help: "Fits tighter rooms and shared setups.", weights: { smallSpace: 1, easeOfUse: 0.55, value: 0.35 } },
    { key: "calls", label: "Calls and focus", help: "Clearer calls and fewer distractions.", weights: { clarity: 1, quietUse: 0.85, easeOfUse: 0.35 } },
    { key: "value", label: "Best price fit", help: "Useful performance per dollar.", weights: { value: 1, durability: 0.45, dailyVersatility: 0.35 } }
  ],
  lifestyle: [
    { key: "everyday", label: "Everyday use", help: "Easy choices for normal daily life.", weights: { dailyVersatility: 1, easeOfUse: 0.7, value: 0.35 } },
    { key: "small-space", label: "Small spaces", help: "Better fit for apartments, travel, or tight kitchens.", weights: { smallSpace: 1, portability: 0.55, easeOfUse: 0.35 } },
    { key: "quiet", label: "Quiet home", help: "Lower noise and less friction at home.", weights: { quietUse: 1, comfort: 0.45, easeOfUse: 0.35 } },
    { key: "premium", label: "Premium pick", help: "A stronger build and more polished ownership feel.", weights: { premiumBuild: 1, durability: 0.65, easeOfUse: 0.25 } }
  ]
};

function countTerms(haystack, terms = []) {
  return terms.reduce((count, term) => count + (haystack.includes(term) ? 1 : 0), 0);
}

function attributeScore(haystack, key, options = {}) {
  const rule = ATTRIBUTE_TERM_RULES[key] ?? { positive: [], negative: [] };
  const positiveCount = countTerms(haystack, rule.positive);
  const negativeCount = countTerms(haystack, rule.negative);
  const base = options.base ?? 48;
  const score = base + positiveCount * 11 - negativeCount * 13 + (options.boost ?? 0);
  return Math.round(clamp(score, 18, 96));
}

function confidenceLabel(product) {
  if (product.evidenceReady === false) return "Developing";
  if (product.signal >= 4 && product.consensus >= 84) return "High";
  if (product.signal >= 3.1 && product.consensus >= 76) return "Solid";
  return "Developing";
}

function recencyStrength(product, category) {
  const publicEvidence = (product.evidence ?? []).filter((item) => item.is_public);
  if (!publicEvidence.length) return 45;
  const averageFreshness = publicEvidence.reduce((total, item) => total + freshnessWeight(item.publishedAt, category.updated), 0) / publicEvidence.length;
  return Math.round(clamp(averageFreshness * 100, 35, 100));
}

function attributeHighlightsForGraph(attributes, keys, limit = 3) {
  return keys
    .map((key) => attributes[key])
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function buildProductAttributeGraph(product, category, decisionTags = []) {
  const haystack = productHaystack(product, category);
  const keys = (SECTION_ATTRIBUTE_KEYS[category.sectionSlug] ?? SECTION_ATTRIBUTE_KEYS.lifestyle)
    .filter((key) => key !== "beginnerFriendliness" || decisionTags.includes("beginner"));
  const attributes = {};

  for (const key of keys) {
    const tagBoost =
      (key === "comfort" && decisionTags.includes("comfort")) ||
      (key === "value" && decisionTags.includes("budget")) ||
      (key === "raceFocus" && decisionTags.includes("performance")) ||
      (key === "distanceSuitability" && decisionTags.includes("distance")) ||
      (key === "beginnerFriendliness" && decisionTags.includes("beginner")) ||
      (key === "smallSpace" && decisionTags.includes("small-space")) ||
      (key === "quietUse" && decisionTags.includes("quiet")) ||
      (key === "premiumBuild" && decisionTags.includes("premium"))
        ? 12
        : 0;

    attributes[key] = {
      key,
      label: ATTRIBUTE_LABELS[key] ?? key,
      score: attributeScore(haystack, key, { boost: tagBoost })
    };
  }

  const evidenceDepth = Math.round(clamp(product.signal * 20, 20, 100));
  const confidence = confidenceLabel(product);
  const recency = recencyStrength(product, category);
  const highlights = attributeHighlightsForGraph(attributes, keys);

  return {
    attributes,
    highlights,
    ownerSentimentSummary: summarizeLikes(product),
    expertSentimentSummary: product.sourceScores?.find((row) => row.source === "Expert")?.summary ?? summarizeLikes(product),
    biggestStrength: biggestStrengthForProduct(product),
    biggestComplaint: biggestComplaintForProduct(product),
    confidenceLevel: confidence,
    evidenceDepth,
    recencyStrength: recency,
    decisionTags
  };
}

function categoryDecisionOptions(category) {
  // Only show the fit finder when its priorities were authored for this exact category.
  // Section-wide fallbacks create convincing but irrelevant matches across unrelated products.
  return CATEGORY_DECISION_OPTIONS[category.slug] ?? [];
}

function optionAttributeLabels(option) {
  return Object.keys(option.weights ?? {})
    .slice(0, 2)
    .map((key) => ATTRIBUTE_LABELS[key] ?? key);
}

function sentenceFragment(value = "") {
  const text = String(value).trim().replace(/\.$/, "");
  if (!text) return text;
  if (/^[A-Z]{2,}\b/.test(text)) return text;
  return `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}

function whyRankedHere(product, rank) {
  const leader = product.attributeGraph?.highlights?.[0];
  const proofChannels = humanList(product.sourceScores.map((row) => row.source.toLowerCase()));
  const strength = sentenceFragment(cleanSnippet(product.biggestStrengthForProduct ?? product.biggestStrength, 112));
  const complaint = sentenceFragment(cleanSnippet(product.biggestComplaintForProduct ?? product.biggestComplaint, 104));
  const rankPhrase = rank === 1
    ? "It sits at #1 because"
    : `It lands at #${rank} because`;
  const limiter = rank === 1
    ? `Main watch-out: ${complaint}.`
    : `Main reason it does not rank higher: ${complaint}.`;
  const proofLine = proofChannels
    ? `The backing proof comes from ${proofChannels} evidence.`
    : "The ranking is based on the available public proof.";

  return `${rankPhrase} ${strength}${leader ? `, with especially strong ${leader.label.toLowerCase()}` : ""}. ${proofLine} ${limiter}`;
}

function decisionBadgesForProduct(product, category, rank) {
  const tags = decisionTagsForProduct(product, category);
  const badges = [];
  const add = (label) => {
    if (!badges.includes(label)) badges.push(label);
  };
  const beginnerPositiveText = [
    product.tag,
    product.bestFor,
    product.verdict,
    ...(product.pros ?? []),
    ...(product.positiveThemes ?? [])
  ].join(" ").toLowerCase();
  const beginnerAvoidText = [
    product.avoidIf,
    ...(product.cons ?? []),
    ...(product.cautionThemes ?? [])
  ].join(" ").toLowerCase();
  const isBeginnerFriendly = /beginner|first|starter|approachable|easygoing|new runner|new trail/i.test(beginnerPositiveText) &&
    !/beginner|first trail|newer runner|new runner|starter/i.test(beginnerAvoidText);

  if (rank === 1) add(product.evidenceReady ? "Best Overall" : "Editorial Starting Point");
  if (tags.includes("budget")) add("Best Value");
  if (tags.includes("beginner") && isBeginnerFriendly) add("Beginner Friendly");
  if (tags.includes("distance")) add("Best for Distance");
  if (tags.includes("comfort")) add("Comfort Pick");
  if (tags.includes("performance")) add("Performance Pick");
  if (tags.includes("small-space")) add("Small-Space Pick");
  if (tags.includes("quiet")) add("Quiet Pick");
  if (tags.includes("premium")) add("Premium Pick");
  if (rank <= 3 && badges.length < 2) add(rank === 1 ? "Top Rated" : "Frequently Recommended");

  return badges.slice(0, 3);
}

function polishRankTag(tag = "", rank = 1, evidenceReady = true) {
  const text = polishBuyerCopy(tag);
  if (rank === 1 && !evidenceReady && /^best overall/i.test(text)) return text.replace(/^best overall/i, "Leading candidate");
  if (rank > 1 && /^best overall by lab testing/i.test(text)) return "Lab-tested all-rounder";
  if (rank > 1 && /^best overall/i.test(text)) return text.replace(/^best overall/i, "Strong");
  return text;
}

function decisionSummaryForProduct(product) {
  const tag = polishBuyerCopy(product.tag || "").toLowerCase();
  const options = [product.verdict, product.bestFor, ...(product.positiveThemes ?? []), ...(product.pros ?? [])]
    .map((item) => polishBuyerCopy(item || ""))
    .filter(Boolean)
    .filter((item) => item.toLowerCase() !== tag);
  return cleanSnippet(options[0] || product.verdict || product.bestFor || product.tag, 118);
}

function sourceProofSummaryForProduct(product) {
  const rows = (product.sourceScores ?? [])
    .filter((row) => row.evidenceCount)
    .map((row) => `${row.source} (${row.evidenceCount})`);
  return rows.length ? rows.join(" / ") : "Evidence under review";
}

function modelFreshnessForProduct(product, category, rank) {
  const haystack = `${product.name} ${product.tag ?? ""} ${product.verdict ?? ""} ${(product.evidence ?? []).map((item) => `${item.title ?? ""} ${item.summary ?? ""} ${item.evidence_note ?? ""}`).join(" ")}`.toLowerCase();

  if (!(product.sourceScores ?? []).length) {
    return {
      status: "ranking under review",
      note: "Ranking under review while stronger public evidence is curated."
    };
  }

  if (/newer model available|recently replaced|replaced by|older model|previous model|discontinued/.test(haystack)) {
    return {
      status: /newer model available|replaced by|recently replaced/.test(haystack) ? "newer model available" : "still worth buying",
      note: "Model freshness should be rechecked before treating this as a default pick."
    };
  }

  if (/newer model|latest model|current model/.test(haystack)) {
    return {
      status: "current model",
      note: "Current-model evidence is visible in the sources."
    };
  }

  if (rank === 1 && product.recencyStrength >= 90 && (product.sourceScores ?? []).length >= 2) {
    return {
      status: "current model",
      note: "Current model with strong recent evidence."
    };
  }

  return null;
}

function buildDecisionSnapshot(products = []) {
  const bestOverall = products[0];
  const bestValue = products.find((product) =>
    product.rank !== bestOverall?.rank &&
    ((product.decisionBadges ?? []).includes("Best Value") ||
      (product.decisionTags ?? []).some((tag) => ["budget", "value"].includes(tag)) ||
      /value|budget|price/i.test(`${product.tag ?? ""} ${product.bestFor ?? ""}`))
  );
  const useCasePick = products.find((product) =>
    product.rank !== bestOverall?.rank &&
    product.rank !== bestValue?.rank &&
    (product.decisionBadges ?? []).some((badge) => /distance|comfort|performance|beginner|premium|small/i.test(badge))
  ) ?? products.find((product) => product.rank !== bestOverall?.rank && product.rank !== bestValue?.rank);

  return {
    bestOverall,
    bestValue,
    useCasePick,
    biggestCaution: bestOverall?.biggestComplaint ?? "",
    sourceProof: bestOverall ? sourceProofSummaryForProduct(bestOverall) : "Evidence under review"
  };
}

function biggestStrengthForProduct(product) {
  return firstUsefulLine([
    ...(product.positiveThemes ?? []),
    ...(product.pros ?? []),
    product.bestFor
  ], "The strongest evidence points to a clear buyer fit.");
}

function biggestComplaintForProduct(product) {
  return firstUsefulLine([
    ...(product.cautionThemes ?? []),
    ...(product.cons ?? []),
    product.avoidIf
  ], "The main tradeoff depends on fit, budget, or personal preference.");
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

function resolveAffiliateOverride(product, category) {
  const normalizedProduct = product.name.toLowerCase();
  const normalizedCategory = category.slug.toLowerCase();
  return affiliateOverrides.find((item) => {
    const productMatches = item.productName?.toLowerCase() === normalizedProduct;
    const categoryMatches = !item.categorySlug || item.categorySlug.toLowerCase() === normalizedCategory;
    return productMatches && categoryMatches;
  });
}

function resolveAffiliateUrl(product, category) {
  const override = resolveAffiliateOverride(product, category);

  if (override?.disabled) return "";
  return override?.url || product.affiliateUrl;
}

function normalizeShoppingLink(link = {}, fallbackLabel = "Buy now") {
  const url = withAmazonAffiliateTag(link.url ?? "");
  if (!url) return null;

  const retailerName = retailerLabel(link.retailer || parseDomain(url));
  const label = link.label || fallbackLabel;

  return {
    ...link,
    label,
    displayLabel: shoppingCtaLabel(label, retailerName),
    url,
    retailerName
  };
}

function resolveShoppingLinks(product, category) {
  const override = resolveAffiliateOverride(product, category);
  if (override?.disabled) return [];
  const rawLinks = override?.shoppingLinks?.length
    ? override.shoppingLinks
    : product.shoppingLinks?.length
      ? product.shoppingLinks
      : [{ label: "Buy now", retailer: override?.retailer, url: resolveAffiliateUrl(product, category) }];

  return rawLinks
    .map((link) => normalizeShoppingLink(link, rawLinks.length > 1 ? "Buy" : "Buy now"))
    .filter(Boolean);
}

function retailerLabel(value = "") {
  const normalized = String(value || "").replace(/^www\./, "").toLowerCase();
  const labels = {
    "amazon.com": "Amazon",
    "walmart.com": "Walmart",
    "flexispot.com": "FlexiSpot",
    "gossamergear.com": "Gossamer Gear",
    "patagonia.com": "Patagonia",
    "kanefootwear.com": "Kane",
    "birkenstock.com": "Birkenstock",
    "grovemade.com": "Grovemade",
    "protechprojection.com": "ProTech Projection",
    "zsa.io": "ZSA"
  };

  if (labels[normalized]) return labels[normalized];
  if (!normalized) return "Retailer";
  return normalized
    .replace(/\.(com|net|org|io|co)$/i, "")
    .split(/[.-]/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function shoppingCtaLabel(label = "", retailerName = "Retailer") {
  const normalized = String(label || "").trim();
  const audienceMatch = normalized.match(/^buy\s+(men|women)$/i);
  if (audienceMatch) {
    const audience = audienceMatch[1].toLowerCase() === "men" ? "Men's" : "Women's";
    return `${audience} at ${retailerName}`;
  }

  if (!normalized || /^(buy|buy now|shop|shop now|view deal|check price)$/i.test(normalized)) {
    return `Check price at ${retailerName}`;
  }

  return normalized;
}

function sourceKey(item) {
  return String(item.url || item.title || item.sourceName || "").trim().toLowerCase();
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

function productSourceTokens(product) {
  return String(product.name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !PRODUCT_TOKEN_STOPWORDS.has(token));
}

function sourceQualityFlags(item, product, sourceType, exactPublicUrl) {
  const url = item.url ?? "";
  const text = `${item.title ?? ""} ${item.sourceName ?? ""} ${item.publisher ?? ""} ${item.summary ?? ""} ${item.evidence_note ?? ""} ${url}`.toLowerCase();
  const flags = [];
  const productTokens = productSourceTokens(product);
  const productMentioned = productTokens.length === 0 || productTokens.some((token) => text.includes(token));
  const lowRelevance = typeof item.relevance === "number" && item.relevance < 0.55;

  if (!exactPublicUrl) flags.push("generic_or_non_exact_url");
  if (/amazon\.com|amzn\.to|ebay\.com|walmart\.com|target\.com|bestbuy\.com|backcountry\.com|rei\.com\/product|runningwarehouse\.com\/[^/]*\/.*\.html/i.test(url) && sourceType === "retailer") {
    flags.push("for_sale_listing");
  }
  if (sourceType === "youtube" && !parseYouTubeId(url)) flags.push("generic_youtube_link");
  if (sourceType === "reddit" && !/reddit\.com\/r\/[^/]+\/comments\//i.test(url)) flags.push("generic_reddit_link");
  if (sourceType === "reddit" && (item.discussion_quality === "low" || (item.sampleSize ?? 0) > 0 && (item.sampleSize ?? 0) < 3)) {
    flags.push("weak_owner_discussion");
  }
  if (sourceType === "youtube" && /shorts|unboxing|first look|commercial|promo|ad\b|sale|deal/i.test(text) && !/review|test|tested|comparison|after|miles|long term|long-term/i.test(text)) {
    flags.push("weak_video_context");
  }
  if (/setup question|sizing question|quick question|deal alert|coupon|sale price|where to buy/i.test(text) && !/review|tested|owner|experience|miles|long term|long-term/i.test(text)) {
    flags.push("low_decision_value");
  }
  if (!productMentioned && ["youtube", "reddit"].includes(sourceType)) flags.push("product_relevance_unclear");
  if (lowRelevance) flags.push("low_relevance_score");

  return flags;
}

function sourceDecisionQuality(item, sourceType, exactPublicUrl, qualityFlags = []) {
  if (sourceType === "retailer" || /amazon\.com|amzn\.to|walmart\.com|target\.com|bestbuy\.com/i.test(item.url ?? "")) {
    return "commercial/affiliate source";
  }

  if (["brand", "specs"].includes(sourceType)) return "specs only";
  if (!exactPublicUrl || item.is_generic_discovery || qualityFlags.some((flag) => ["generic_or_non_exact_url", "generic_youtube_link", "generic_reddit_link"].includes(flag))) {
    return "weak mention";
  }

  if (qualityFlags.some((flag) => ["product_relevance_unclear", "low_relevance_score", "low_decision_value"].includes(flag))) {
    return "irrelevant";
  }

  if (qualityFlags.length) return "weak mention";
  if ((item.evidence_polarity ?? inferEvidencePolarity(item)) === "caution") return "useful caution evidence";
  return "strong decision evidence";
}

function evidenceOverridesFor(product, category) {
  return evidenceOverrides
    .filter((entry) => {
      const productMatches = entry.productName?.toLowerCase() === product.name.toLowerCase();
      const categoryMatches = !entry.categorySlug || entry.categorySlug === category.slug;
      return productMatches && categoryMatches;
    })
    .flatMap((entry) => entry.evidence ?? []);
}

function mergeEvidence(product, category) {
  const merged = [];
  const seen = new Set();
  for (const item of [...(product.evidence ?? []), ...evidenceOverridesFor(product, category)]) {
    const key = sourceKey(item);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    merged.push(item);
  }
  return merged;
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

function hasExactPublicUrl(item, sourceType = inferSourceType(item)) {
  const url = item.url ?? "";
  if (!url) return false;
  if (url.includes("youtube.com/results") || url.includes("reddit.com/search")) return false;
  if (/youtube\.com\/(channel|@|c\/|user\/)/i.test(url)) return false;
  if (sourceType === "youtube" && !parseYouTubeId(url)) return false;
  if (sourceType === "reddit" && !/reddit\.com\/r\/[^/]+\/comments\//i.test(url)) return false;
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
  return "Hands-on or category-specific testing reported by the cited source.";
}

function normalizeEvidenceItem(item, product, category, index) {
  const sourceType = inferSourceType(item);
  const sourceTier = item.source_tier ?? sourceTierKey(item.tier);
  const exactPublicUrl = hasExactPublicUrl(item, sourceType);
  const isGenericDiscovery = !exactPublicUrl || /corpus|sentiment sample|discovery/i.test(`${item.sourceName ?? ""} ${item.evidenceType ?? ""}`);
  const qualityFlags = sourceQualityFlags(item, product, sourceType, exactPublicUrl);
  const videoId = sourceType === "youtube" ? (item.video_id ?? parseYouTubeId(item.url)) : undefined;
  const subreddit = sourceType === "reddit" ? (item.subreddit ?? parseRedditSubreddit(item.url)) : undefined;
  const isPublic = item.is_public === false
    ? false
    : exactPublicUrl && !isGenericDiscovery && qualityFlags.length === 0 && sourceType !== "retailer";
  const sourceDecisionQualityLabel = sourceDecisionQuality(
    { ...item, is_generic_discovery: isGenericDiscovery },
    sourceType,
    exactPublicUrl,
    qualityFlags
  );
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
    evidence_note: polishBuyerCopy(item.evidence_note ?? item.summary ?? ""),
    summary: polishBuyerCopy(item.summary ?? item.evidence_note ?? ""),
    trust_reason: trustReasonForSource({ ...item, source_type: sourceType, source_tier: sourceTier }, category),
    evidence_polarity: inferEvidencePolarity(item),
    is_primary_source: isPrimarySource,
    display_order: item.display_order ?? ((SOURCE_DISPLAY_ORDER[sourceType] ?? 90) + index / 100),
    is_public: isPublic,
    is_exact_url: exactPublicUrl,
    is_generic_discovery: isGenericDiscovery,
    source_quality_flags: qualityFlags,
    source_decision_quality: sourceDecisionQualityLabel,
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

function scorecardSourceLabel(item) {
  const publisher = String(item.publisher || item.sourceName || "").trim();
  const fallback = String(item.title || item.sourceName || "Source").trim();

  if (item.source_type === "youtube") {
    return cleanSnippet(publisher ? `${publisher} video` : fallback, 58);
  }

  if (item.source_type === "reddit") {
    const community = publisher || (item.subreddit ? `r/${item.subreddit}` : "");
    if (community && /\b(thread|comment|discussion|post)\b/i.test(community)) return cleanSnippet(community, 58);
    return cleanSnippet(community ? `${community} thread` : fallback, 58);
  }

  return cleanSnippet(publisher || fallback, 58);
}

function scorecardSourcesForRow(evidence) {
  return [...evidence]
    .filter((item) => item.is_public && item.url && !item.is_generic_discovery)
    .sort(publicSourceSort)
    .slice(0, 3)
    .map((item) => ({
      ...item,
      scorecardLabel: scorecardSourceLabel(item)
    }));
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

function renderMeasurementTags(file) {
  if (file === "operator-dashboard.html") return "";
  const tags = [];

  if (analyticsConfig.googleSiteVerification) {
    tags.push(`<meta name="google-site-verification" content="${escapeHtml(analyticsConfig.googleSiteVerification)}" />`);
  }

  if (analyticsConfig.bingSiteVerification) {
    tags.push(`<meta name="msvalidate.01" content="${escapeHtml(analyticsConfig.bingSiteVerification)}" />`);
  }

  if (analyticsConfig.ga4MeasurementId) {
    const id = escapeHtml(analyticsConfig.ga4MeasurementId);
    tags.push(`<script>
    if (["www.phavai.com", "phavai.com"].includes(window.location.hostname)) {
      var gaScript = document.createElement("script");
      gaScript.async = true;
      gaScript.src = "https://www.googletagmanager.com/gtag/js?id=${id}";
      document.head.appendChild(gaScript);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function(){window.dataLayer.push(arguments);};
      window.gtag("js", new Date());
      window.gtag("config", "${id}", {
        anonymize_ip: true,
        transport_type: "beacon"
      });
    }
  </script>`);
  }

  if (analyticsConfig.clarityProjectId) {
    const id = escapeHtml(analyticsConfig.clarityProjectId);
    tags.push(`<script>
    if (["www.phavai.com", "phavai.com"].includes(window.location.hostname)) {
      (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "${id}");
    }
  </script>`);
  }

  return tags.length ? `\n  <!-- Phavai measurement and webmaster tags: generated at build time from site config and environment variables. -->\n  ${tags.join("\n  ")}\n` : "";
}

function renderSiteIdentityTags(file) {
  const canonicalUrl = file === "index.html" ? "https://www.phavai.com/" : `https://www.phavai.com/${file}`;
  const tags = [
    `<meta property="og:site_name" content="Phavai" />`,
    `<meta property="og:url" content="${canonicalUrl}" />`,
    `<link rel="icon" href="/favicon.svg" type="image/svg+xml" />`
  ];

  if (file === "index.html") {
    tags.push(`<script type="application/ld+json">
  ${JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://www.phavai.com/#organization",
        "name": "Phavai",
        "url": "https://www.phavai.com/",
        "description": "AI-assisted, human-reviewed buying guides that synthesize recurring pros, cons, specifications, and tradeoffs from selected public sources.",
        "founder": { "@id": editorialProfile.id }
      },
      {
        "@type": "WebSite",
        "@id": "https://www.phavai.com/#website",
        "url": "https://www.phavai.com/",
        "name": "Phavai",
        "publisher": { "@id": "https://www.phavai.com/#organization" },
        "inLanguage": "en-US"
      },
      {
        "@type": "Person",
        "@id": editorialProfile.id,
        "name": editorialProfile.name,
        "url": editorialProfile.id,
        "jobTitle": editorialProfile.role,
        "knowsAbout": editorialProfile.knowsAbout || []
      }
    ]
  }, null, 2)}
  </script>`);
  }

  return `\n  <!-- Phavai site identity tags: generated at build time. -->\n  ${tags.join("\n  ")}\n`;
}

function injectSiteIdentityTags() {
  for (const file of readdirSync(".")) {
    if (!file.endsWith(".html")) continue;
    const tags = renderSiteIdentityTags(file);
    const html = readFileSync(file, "utf8");
    const withoutOldTags = html.replace(/\n\s*<!-- Phavai site identity tags:[\s\S]*?\n(?=\s*<\/head>)/, "\n");
    const nextHtml = withoutOldTags.replace("</head>", `${tags}</head>`);
    if (nextHtml !== html) writeFileSync(file, nextHtml, "utf8");
  }
}

function injectMeasurementTags() {
  for (const file of readdirSync(".")) {
    if (!file.endsWith(".html")) continue;
    const tags = renderMeasurementTags(file);
    const html = readFileSync(file, "utf8");
    const withoutOldTags = html.replace(/\n\s*<!-- Phavai measurement and webmaster tags:[\s\S]*?\n(?=\s*<\/head>)/, "\n");
    const nextHtml = tags ? withoutOldTags.replace("</head>", `${tags}</head>`) : withoutOldTags;
    if (nextHtml !== html) writeFileSync(file, nextHtml, "utf8");
  }
}

function injectStylesheetVersion() {
  for (const file of readdirSync(".")) {
    if (!file.endsWith(".html")) continue;
    const html = readFileSync(file, "utf8");
    const nextHtml = html.replace(/href="\/styles\.css(?:\?v=[^"]*)?"/g, `href="/styles.css?v=${ASSET_VERSION}"`);
    if (nextHtml !== html) writeFileSync(file, nextHtml, "utf8");
  }
}

function currentSectionForFile(file) {
  const pageSlug = file.replace(/\.html$/i, "");
  const category = builtCategories.find((item) => item.slug === pageSlug);
  if (category) return category.sectionSlug;

  const supportingPage = supportingPages.find((item) => item.slug === pageSlug);
  if (supportingPage) return supportingPage.sectionSlug;

  if (["data-lab", "gps-battery-planner", "trail-shoe-matrix", "running-headphone-specification-database"].includes(pageSlug)) return "data-lab";
  return sections.some((item) => item.slug === pageSlug) ? pageSlug : "";
}

function currentAttribute(isCurrent, currentValue = "page") {
  return isCurrent ? ` class="is-current" aria-current="${currentValue}"` : "";
}

function renderGlobalHeader(file) {
  const activeSection = currentSectionForFile(file);
  const sectionLinks = sections.map((section) => {
    const label = section.slug === "outdoor" ? "Running &amp; Outdoor" : escapeHtml(section.title);
    const currentValue = file === `${section.slug}.html` ? "page" : "location";
    return `<a href="/${section.slug}.html"${currentAttribute(activeSection === section.slug, currentValue)}>${label}</a>`;
  }).join("\n        ");
  const methodCurrent = file === "methodology.html" || file === "editorial-standards.html";
  const methodCurrentValue = file === "methodology.html" ? "page" : "location";
  const dataLabCurrent = activeSection === "data-lab";
  const dataLabCurrentValue = file === "data-lab.html" ? "page" : "location";

  return `<header class="site-header">
    <nav class="nav" aria-label="Primary navigation">
      <a class="brand${file === "index.html" ? " is-current" : ""}" href="/"${file === "index.html" ? ' aria-current="page"' : ""}><span class="brand-mark">P</span> Phavai</a>
      <div class="nav-links">
        ${sectionLinks}
        <a href="/data-lab.html"${currentAttribute(dataLabCurrent, dataLabCurrentValue)}>Data Lab</a>
        <a class="hide-small${methodCurrent ? " is-current" : ""}" href="/methodology.html"${methodCurrent ? ` aria-current="${methodCurrentValue}"` : ""}>How it works</a>
      </div>
    </nav>
  </header>`;
}

function renderGlobalFooter() {
  const affiliateDisclosure = AFFILIATE_CONFIG.affiliateEnabled
    ? '<p class="footer-disclosure">As an Amazon Associate I earn from qualifying purchases. Retail links never affect our rankings.</p>'
    : "";

  return `<footer class="site-footer">
    <div class="footer-grid footer-grid--expanded">
      <div class="footer-intro">
        <a class="footer-brand-link" href="/">Phavai</a>
        <p>AI-assisted product research, checked by a named human editor. Sources and meaningful tradeoffs stay visible.</p>
        ${affiliateDisclosure}
      </div>
      <nav class="footer-nav" aria-label="Guide collections">
        <strong>Explore</strong>
        <a href="/outdoor.html">Running &amp; Outdoor</a>
        <a href="/remote-work.html">Remote Work</a>
        <a href="/lifestyle.html">Lifestyle</a>
        <a href="/data-lab.html">Data Lab</a>
      </nav>
      <nav class="footer-nav" aria-label="About Phavai">
        <strong>Trust &amp; support</strong>
        <a href="/methodology.html">How it works</a>
        <a href="/editorial-standards.html">Editorial standards</a>
        <a href="/about.html">About</a>
        <a href="/contact.html">Corrections &amp; contact</a>
      </nav>
    </div>
    <div class="footer-bottom">
      <span>&copy; 2026 Phavai</span>
      <span><a href="/privacy.html">Privacy</a> <a href="/terms.html">Terms</a> <a href="#main-content">Back to top</a></span>
    </div>
  </footer>`;
}

function normalizeSiteNavigation() {
  const todaysPicksRetired = todaysPicks?.indexable === false;
  for (const file of readdirSync(".")) {
    if (!file.endsWith(".html")) continue;
    const html = readFileSync(file, "utf8");
    let nextHtml = html.replace(/href="\/index\.html"/g, 'href="/"');
    if (todaysPicksRetired) {
      nextHtml = nextHtml.replace(/\s*<a\b[^>]*href="\/todays-picks\.html"[^>]*>[\s\S]*?<\/a>/g, "");
    }
    nextHtml = nextHtml.replace(/<header class="site-header">[\s\S]*?<\/header>/i, renderGlobalHeader(file));
    nextHtml = nextHtml.replace(/<footer class="site-footer">[\s\S]*?<\/footer>/i, renderGlobalFooter());
    if (!/class="skip-link"/.test(nextHtml)) {
      nextHtml = nextHtml.replace(/<body([^>]*)>/i, '<body$1>\n  <a class="skip-link" href="#main-content">Skip to main content</a>');
    }
    if (!/id="main-content"/.test(nextHtml)) {
      nextHtml = nextHtml.replace(/<main(\s|>)/i, '<main id="main-content"$1');
    }
    if (nextHtml !== html) writeFileSync(file, nextHtml, "utf8");
  }
}

function trimGeneratedHtml() {
  for (const file of readdirSync(".")) {
    if (!file.endsWith(".html")) continue;
    const html = readFileSync(file, "utf8");
    const nextHtml = trimLineEndWhitespace(html);
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

function isScoreEligibleEvidence(item) {
  if (!item.is_public || item.is_generic_discovery || !item.is_exact_url || !item.url) return false;
  if (item.source_type === "youtube") return Boolean(item.video_id);
  if (item.source_type === "reddit") return /reddit\.com\/r\/[^/]+\/comments\//i.test(item.url);
  if (["brand", "specs", "retailer"].includes(item.source_type)) return false;
  return true;
}

function buildChannelScores(product, category) {
  const configuredWeights = category.sourceWeights ?? DEFAULT_SOURCE_WEIGHTS;
  const evidenceChannels = product.evidence
    .map((item) => item.channel)
    .filter((channel) => ["Expert", "YouTube", "Reddit"].includes(channel));
  const channels = [...new Set([...Object.keys(configuredWeights), ...evidenceChannels])];
  const rows = channels
    .map((channel) => {
      const evidence = product.evidence
        .filter((item) => item.channel === channel && isScoreEligibleEvidence(item))
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
        weight: configuredWeights[channel] ?? 0,
        score: Number(score.toFixed(1)),
        evidenceCount: evidence.length,
        tier: bestTierLabel(evidence),
        summary: summarizeEvidence(evidence),
        topEvidence: bestDisplayEvidence(evidence),
        displaySources: scorecardSourcesForRow(evidence),
        evidence
      };
    })
    .filter(Boolean);

  const activeWeightTotal = rows.reduce((total, row) => total + row.weight, 0) || 1;
  return rows.map((row) => ({
    ...row,
    baseWeight: row.weight,
    weight: Number(((row.weight / activeWeightTotal) * 100).toFixed(1))
  }));
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
  const evidence = (product.evidence ?? []).filter((item) => item.is_public);
  const channelsWithEvidence = new Set(evidence.map((item) => item.channel)).size;
  const expectedChannels = Math.max(channelScores.length, 1);
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
  const normalizedEvidence = mergeEvidence(product, category).map((item, index) => normalizeEvidenceItem(item, product, category, index));
  const normalizedProduct = { ...product, evidence: normalizedEvidence };
  const channelScores = buildChannelScores(normalizedProduct, category);
  const scoreInputs = channelScores
    .filter((row) => row.weight > 0)
    .map((row) => ({
      score: row.score,
      weight: row.weight
    }));
  const rawScore = scoreInputs.length ? weightedMean(scoreInputs) : 0;
  const disagreement = scoreInputs.length ? weightedStandardDeviation(scoreInputs, rawScore) : 0;
  const signal = computeSignal(normalizedProduct, channelScores, category);
  const publicEvidenceCount = normalizedEvidence.filter((item) => item.is_public).length;
  const qualifyingEvidence = normalizedEvidence.filter(isScoreEligibleEvidence);
  const qualifyingExpertCount = qualifyingEvidence.filter((item) => item.source_type === "expert").length;
  const qualifyingChannelCount = new Set(qualifyingEvidence.map((item) => item.channel)).size;
  const evidenceReady = qualifyingExpertCount >= 1 && qualifyingEvidence.length >= 3 && qualifyingChannelCount >= 2;
  const publicProduct = {
    ...normalizedProduct,
    verdict: polishBuyerCopy(normalizedProduct.verdict),
    bestFor: polishBuyerCopy(normalizedProduct.bestFor),
    avoidIf: polishBuyerCopy(normalizedProduct.avoidIf),
    pros: (normalizedProduct.pros ?? []).map(polishBuyerCopy),
    cons: (normalizedProduct.cons ?? []).map(polishBuyerCopy),
    positiveThemes: (normalizedProduct.positiveThemes ?? []).map(polishBuyerCopy),
    cautionThemes: (normalizedProduct.cautionThemes ?? []).map(polishBuyerCopy)
  };
  const affiliateOverride = resolveAffiliateOverride(normalizedProduct, category);
  let shoppingLinks = resolveShoppingLinks(normalizedProduct, category);
  const catalogAsin = String((affiliateOverride?.disabled ? "" : affiliateOverride?.asin) || shoppingLinks.map((link) => asinFromAmazonUrl(link.url)).find(Boolean) || "").toUpperCase();
  const catalogItem = AMAZON_CATALOG.get(catalogAsin);
  if (catalogItem?.detailPageURL && shoppingLinks[0] && /(^|\.)amazon\.com$/i.test(parseDomain(shoppingLinks[0].url))) {
    shoppingLinks = [{ ...shoppingLinks[0], url: withAmazonAffiliateTag(catalogItem.detailPageURL) }, ...shoppingLinks.slice(1)];
  }
  const resolvedAffiliateUrl = shoppingLinks[0]?.url ?? withAmazonAffiliateTag(resolveAffiliateUrl(normalizedProduct, category));

  return {
    ...publicProduct,
    affiliateUrl: resolvedAffiliateUrl,
    shoppingLinks,
    retailerName: shoppingLinks[0]?.retailerName || retailerLabel(affiliateOverride?.retailer || parseDomain(resolvedAffiliateUrl)),
    catalogAsin,
    catalogTitle: catalogItem?.title || "",
    catalogImage: catalogItem?.image?.url ? catalogItem.image : null,
    imageInfo,
    priceInsight: buildPriceInsight(normalizedProduct),
    sourceScores: channelScores,
    evidenceSummary: buildEvidenceSummary(publicProduct, channelScores),
    publicEvidence: selectPublicEvidence(channelScores.flatMap((row) => row.evidence)),
    internalEvidenceCount: normalizedEvidence.filter((item) => !item.is_public).length,
    rawBestPickScore: Number(rawScore.toFixed(1)),
    bestPickScore: Math.round(rawScore),
    publicScoreLabel: evidenceReady ? String(Math.round(rawScore)) : "Developing",
    evidenceReady,
    qualifyingEvidenceCount: qualifyingEvidence.length,
    qualifyingExpertCount,
    qualifyingChannelCount,
    consensus: Math.round(clamp(100 - disagreement * 4, 0, 100)),
    signal,
    recencyStrength: recencyStrength(publicProduct, category),
    evidenceCount: publicEvidenceCount
  };
}

const sectionsBySlug = new Map(sections.map((section) => [section.slug, section]));
const supportBySection = new Map(
  sections.map((section) => [
    section.slug,
    supportingPages.filter((page) => page.sectionSlug === section.slug)
  ])
);
const dataLabTools = [
  gpsBatteryPlanner ? {
    title: gpsBatteryPlanner.title,
    description: gpsBatteryPlanner.description,
    url: `/${gpsBatteryPlanner.slug}.html`,
    type: "Interactive planner",
    sectionSlugs: gpsBatteryPlanner.sectionSlugs || [],
    relatedReviewSlugs: gpsBatteryPlanner.relatedReviewSlugs || [],
    relatedSupportingSlugs: gpsBatteryPlanner.relatedSupportingSlugs || []
  } : null,
  trailShoeMatrix ? {
    title: trailShoeMatrix.title,
    description: trailShoeMatrix.description,
    url: `/${trailShoeMatrix.slug}.html`,
    type: "Filterable matrix",
    sectionSlugs: trailShoeMatrix.sectionSlugs || [],
    relatedReviewSlugs: trailShoeMatrix.relatedReviewSlugs || [],
    relatedSupportingSlugs: trailShoeMatrix.relatedSupportingSlugs || []
  } : null,
  runningHeadphoneSpecifications ? {
    title: runningHeadphoneSpecifications.title,
    description: runningHeadphoneSpecifications.description,
    url: `/${runningHeadphoneSpecifications.slug}.html`,
    type: "Specification database",
    sectionSlugs: runningHeadphoneSpecifications.sectionSlugs || [],
    relatedReviewSlugs: runningHeadphoneSpecifications.relatedReviewSlugs || [],
    relatedSupportingSlugs: runningHeadphoneSpecifications.relatedSupportingSlugs || []
  } : null
].filter(Boolean);
const builtCategories = categories.map((category) => {
  const sourceWeights = category.sourceWeights ?? DEFAULT_SOURCE_WEIGHTS;
  const products = category.products
    .map((product) => computeProductScores(product, { ...category, sourceWeights }))
    .map((product, index) => {
      const rank = index + 1;
      const tag = polishRankTag(product.tag, rank, product.evidenceReady);
      const publicProduct = { ...product, tag };
      const decisionTags = decisionTagsForProduct(publicProduct, category);
      const biggestStrength = biggestStrengthForProduct(product);
      const biggestComplaint = biggestComplaintForProduct(product);
      const productForGraph = { ...publicProduct, biggestStrength, biggestComplaint };
      const attributeGraph = buildProductAttributeGraph(productForGraph, category, decisionTags);
      const visualProfile = visualProfileForProduct(publicProduct, category, decisionTags);
      const modelFreshness = modelFreshnessForProduct(publicProduct, category, rank);
      return {
        ...publicProduct,
        rank,
        decisionTags,
        decisionBadges: decisionBadgesForProduct(publicProduct, category, rank),
        decisionSummary: decisionSummaryForProduct(publicProduct),
        sourceProofSummary: sourceProofSummaryForProduct(publicProduct),
        modelFreshness,
        biggestStrength,
        biggestComplaint,
        attributeGraph,
        attributeHighlights: attributeGraph.highlights,
        rankExplanation: whyRankedHere({ ...publicProduct, biggestStrength, biggestComplaint, attributeGraph }, rank),
        iconSvg: productIconFor(publicProduct, category),
        visualKind: classToken(visualProfile.kind),
        visualVariant: classToken(visualProfile.variant),
        visualRole: visualProfile.role,
        visualAttributes: visualProfile.attributes,
        visualSvg: visualProfile.svg
      };
    });

  return {
    ...category,
    flagshipResearch: category.slug === "best-running-headphones" && category.flagshipResearch
      ? {
          ...category.flagshipResearch,
          resourceLinks: [
            { label: "Download the normalized specification database", url: "/running-headphone-specification-database.html" },
            { label: "Compare OpenRun Pro 2 vs OpenFit 2", url: "/shokz-openrun-pro-2-vs-openfit-2-for-running.html" },
            { label: "Compare open-ear vs sealed earbuds", url: "/open-ear-vs-sealed-earbuds-for-road-running.html" }
          ]
        }
      : category.flagshipResearch,
    socialImage: existsSync(`photos/generated/guide-${category.slug}-social.png`)
      ? `/photos/generated/guide-${category.slug}-social.png`
      : "",
    description: polishBuyerCopy(category.description),
    lede: polishBuyerCopy(category.lede ?? category.description ?? ""),
    metaDescription: conciseMetaDescription(polishBuyerCopy(category.metaDescription ?? category.description)),
    comparisonIntro: polishBuyerCopy(category.comparisonIntro ?? ""),
    finalRecommendation: polishBuyerCopy(category.finalRecommendation ?? ""),
    faqs: (category.faqs ?? []).map((faq) => ({
      ...faq,
      question: polishBuyerCopy(faq.question),
      answer: polishBuyerCopy(faq.answer)
    })),
    section: sectionsBySlug.get(category.sectionSlug),
    sourceWeights,
    decisionOptions: categoryDecisionOptions(category).map((option) => ({
      ...option,
      attributeLabels: optionAttributeLabels(option)
    })),
    decisionSnapshot: buildDecisionSnapshot(products),
    products,
    datePublished: toIsoDate(category.published || category.updated),
    dateModified: toIsoDate(category.updated),
    isCoreRoundup: CORE_ROUNDUP_SLUGS.has(category.slug),
    iconSvg: reviewIconFor(category)
  };
});

const RELATED_TOKEN_STOPWORDS = new Set([
  "best", "for", "the", "and", "with", "from", "your", "men", "mens", "women", "womens", "remote", "work"
]);

const RELATED_TOPIC_RULES = [
  ["trail-footwear", /trail.*(?:shoe|trainer)|(?:shoe|trainer).*trail/],
  ["road-footwear", /marathon|road.*shoe|daily.*trainer|first.*marathon/],
  ["footwear", /shoe|trainer|sandal|slide/],
  ["hydration-carry", /hydration|running.*vest|handheld|water.*bottle|running.*belt|trail.*pole/],
  ["endurance-fuel", /running.*gel|electrolyte|carb.*drink|running.*chew|ultramarathon.*fuel/],
  ["running-tech", /running.*headphone|gps.*watch|running.*watch/],
  ["running-accessory", /running.*(?:sock|sunglass|belt|headphone|watch)|compression.*runner/],
  ["recovery", /recovery|compression.*boot|massage.*gun/],
  ["desk-furniture", /standing.*desk|office.*chair|walking.*pad/],
  ["desk-technology", /monitor|keyboard|webcam|usb.*hub|laptop.*stand|desk.*mat/],
  ["travel", /carry-on|luggage|commuter.*backpack/],
  ["grooming", /shaver|beard.*trimmer|body.*groom/],
  ["home", /coffee.*maker|air.*purifier/],
  ["fitness-nutrition", /dumbbell|protein.*bar|creatine|massage.*gun/]
];

function relatedReviewText(review) {
  return `${review.slug ?? ""} ${review.title ?? ""} ${review.eyebrow ?? ""}`.toLowerCase();
}

function relatedReviewTokens(review) {
  return new Set(
    relatedReviewText(review)
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2 && !RELATED_TOKEN_STOPWORDS.has(token))
  );
}

function relatedReviewSimilarity(current, candidate) {
  const currentText = relatedReviewText(current);
  const candidateText = relatedReviewText(candidate);
  const currentTopics = new Set(RELATED_TOPIC_RULES.filter(([, pattern]) => pattern.test(currentText)).map(([topic]) => topic));
  const candidateTopics = new Set(RELATED_TOPIC_RULES.filter(([, pattern]) => pattern.test(candidateText)).map(([topic]) => topic));
  const sharedTopics = [...currentTopics].filter((topic) => candidateTopics.has(topic)).length;
  const candidateTokens = relatedReviewTokens(candidate);
  const sharedTokens = [...relatedReviewTokens(current)].filter((token) => candidateTokens.has(token)).length;
  return sharedTopics * 20 + sharedTokens * 2;
}

const SECTION_REVIEW_GROUPS = {
  outdoor: [
    { id: "trail-shoes", title: "Trail shoes", description: "Start with fit and terrain, then narrow by distance, cushioning, grip, and race intent.", pattern: /trail.*shoe|shoe.*trail|comfortable-trail/ },
    { id: "road-marathon", title: "Road & marathon shoes", description: "Training and race-day footwear organized by experience, body needs, comfort, and pace goals.", pattern: /marathon|road-shoe|daily-trainer/ },
    { id: "hydration-carry", title: "Hydration & carry", description: "Vests, packs, bottles, belts, and poles for carrying what a run or race actually requires.", pattern: /hydration|running-vest|water-bottle|running-belt|trail-running-pole/ },
    { id: "fuel-electrolytes", title: "Fuel & electrolytes", description: "Compare format, carbohydrate delivery, sodium, flavor tolerance, and training practicality.", pattern: /fuel|running-gel|electrolyte|carb-drink|running-chew/ },
    { id: "watches-audio", title: "Watches, audio & accessories", description: "Running technology and small essentials compared for route awareness, comfort, reliability, and daily use.", pattern: /watch|headphone|running-sock|running-sunglass/ },
    { id: "recovery", title: "Recovery", description: "Post-run tools and footwear assessed by comfort, repeat use, storage, and ownership friction.", pattern: /recovery|compression-boot/ }
  ],
  "remote-work": [
    { id: "posture-movement", title: "Posture & movement", description: "Desks, chairs, stands, and walking pads for a more adjustable workday.", pattern: /standing-desk|office-chair|walking-pad|laptop-stand/ },
    { id: "desk-setup", title: "Desk setup", description: "The accessories that organize connections, screens, input, and everyday desk comfort.", pattern: /monitor-arm|keyboard|desk-mat|usb-c-hub/ },
    { id: "meetings-displays", title: "Meetings & displays", description: "Webcams and portable monitors compared for clarity, setup friction, portability, and reliability.", pattern: /webcam|portable-monitor/ }
  ],
  lifestyle: [
    { id: "travel", title: "Travel", description: "Carry and luggage choices organized around packing, durability, comfort, and trip friction.", pattern: /carry-on|luggage|commuter-backpack/ },
    { id: "grooming", title: "Grooming", description: "Tools compared by comfort, cleanup, attachments, battery, and long-term ownership.", pattern: /shaver|beard-trimmer|body-groomer/ },
    { id: "home", title: "Home", description: "Everyday appliances compared by maintenance, noise, reliability, and recurring cost.", pattern: /coffee-maker|air-purifier/ },
    { id: "fitness-nutrition", title: "Fitness & nutrition", description: "Training and nutrition products organized by repeat use, tolerance, storage, and value.", pattern: /dumbbell|massage-gun|protein-bar|creatine/ }
  ]
};

function buildSectionReviewGroups(sectionSlug, reviews, featuredReviewOrder) {
  const remaining = new Set(reviews.map((review) => review.slug));
  const sortReviews = (items) => [...items].sort((a, b) => {
    const aOrder = featuredReviewOrder.has(a.slug) ? featuredReviewOrder.get(a.slug) : 1000;
    const bOrder = featuredReviewOrder.has(b.slug) ? featuredReviewOrder.get(b.slug) : 1000;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.title.localeCompare(b.title);
  });
  const groups = [];

  for (const group of SECTION_REVIEW_GROUPS[sectionSlug] ?? []) {
    const matches = sortReviews(reviews.filter((review) => remaining.has(review.slug) && group.pattern.test(review.slug)));
    if (!matches.length) continue;
    matches.forEach((review) => remaining.delete(review.slug));
    groups.push({ ...group, reviews: matches });
  }

  const unmatched = sortReviews(reviews.filter((review) => remaining.has(review.slug)));
  if (unmatched.length) {
    groups.push({ id: "more-guides", title: "More buying guides", description: "Additional shortlists for specific buying decisions.", reviews: unmatched });
  }
  return groups;
}

for (const category of builtCategories) {
  const configuredRelatedSlugs = [
    ...(relatedReviewOverrides[category.slug] ?? []),
    ...(category.relatedReviewSlugs ?? [])
  ].filter((slug, index, list) => list.indexOf(slug) === index);
  const relatedReviewOrder = new Map(configuredRelatedSlugs.map((slug, index) => [slug, index]));
  const sectionFeaturedOrder = new Map((sectionsBySlug.get(category.sectionSlug)?.featuredReviewSlugs ?? []).map((slug, index) => [slug, index]));
  const relatedReviews = builtCategories
    .filter((review) => review.sectionSlug === category.sectionSlug && review.slug !== category.slug)
    .sort((a, b) => {
      const aConfigured = relatedReviewOrder.has(a.slug);
      const bConfigured = relatedReviewOrder.has(b.slug);
      if (aConfigured !== bConfigured) return aConfigured ? -1 : 1;
      if (aConfigured && bConfigured) return relatedReviewOrder.get(a.slug) - relatedReviewOrder.get(b.slug);

      const relevanceDelta = relatedReviewSimilarity(category, b) - relatedReviewSimilarity(category, a);
      if (relevanceDelta !== 0) return relevanceDelta;

      const aFeatured = sectionFeaturedOrder.has(a.slug) ? sectionFeaturedOrder.get(a.slug) : 1000;
      const bFeatured = sectionFeaturedOrder.has(b.slug) ? sectionFeaturedOrder.get(b.slug) : 1000;
      if (aFeatured !== bFeatured) return aFeatured - bFeatured;
      return a.title.localeCompare(b.title);
    })
    .map(({ products, ...review }) => ({ ...review, products: products.slice(0, 1) }));
  const html = ejs.render(
    categoryTemplate,
    {
      ...category,
      affiliateConfig: AFFILIATE_CONFIG,
      editorialProfile,
      allSections: sections,
      relatedReviews,
      supportingPages: supportingPages.filter((page) => page.relatedReviewSlugs?.includes(category.slug)),
      relatedDataTools: dataLabTools.filter((tool) => tool.relatedReviewSlugs.includes(category.slug))
    },
    { rmWhitespace: false }
  );
  writeFileSync(`${category.slug}.html`, html, "utf8");
  console.log(`Built: ${category.slug}.html`);
}

for (const section of sections) {
  const reviews = builtCategories.filter((category) => category.sectionSlug === section.slug);
  const featuredReviewOrder = new Map((section.featuredReviewSlugs ?? []).map((slug, index) => [slug, index]));
  const coreReviews = reviews
    .filter((category) => category.isCoreRoundup)
    .sort((a, b) => {
      const aOrder = featuredReviewOrder.has(a.slug) ? featuredReviewOrder.get(a.slug) : 1000;
      const bOrder = featuredReviewOrder.has(b.slug) ? featuredReviewOrder.get(b.slug) : 1000;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.title.localeCompare(b.title);
    });
  const focusedReviews = reviews.filter((category) => !category.isCoreRoundup);
  const reviewGroups = buildSectionReviewGroups(section.slug, reviews, featuredReviewOrder);
  const configuredStartingGuides = (section.featuredReviewSlugs ?? [])
    .map((slug) => reviews.find((review) => review.slug === slug))
    .filter(Boolean);
  const startingGuides = [...configuredStartingGuides, ...reviews]
    .filter((review, index, list) => list.findIndex((item) => item.slug === review.slug) === index)
    .slice(0, 3);
  const html = ejs.render(
    sectionTemplate,
    {
      section: { ...section, iconSvg: iconSvg(section.slug) },
      reviews,
      coreReviews,
      focusedReviews,
      reviewGroups,
      startingGuides,
      supportingPages: supportBySection.get(section.slug) || [],
      relatedDataTools: dataLabTools.filter((tool) => tool.sectionSlugs.includes(section.slug)),
      sourceTrust: sourceGovernance.sections?.[section.slug],
      affiliateConfig: AFFILIATE_CONFIG,
      editorialProfile,
      allSections: sections
    },
    { rmWhitespace: false }
  );
  writeFileSync(`${section.slug}.html`, html, "utf8");
  console.log(`Built: ${section.slug}.html`);
}

for (const page of supportingPages) {
  const section = { ...sectionsBySlug.get(page.sectionSlug), iconSvg: iconSvg(page.sectionSlug) };
  const relatedReviews = (page.relatedReviewSlugs ?? [])
    .map((slug) => builtCategories.find((review) => review.slug === slug))
    .filter(Boolean)
    .filter((review, index, list) => list.findIndex((item) => item.slug === review.slug) === index);
  const html = ejs.render(
    supportingTemplate,
    {
      page: {
        ...page,
        datePublished: toIsoDate(page.published || page.updated),
        dateModified: toIsoDate(page.updated)
      },
      section,
      relatedReviews,
      allSections: sections,
      editorialProfile,
      affiliateConfig: AFFILIATE_CONFIG,
      relatedDataTools: dataLabTools.filter((tool) => tool.relatedSupportingSlugs.includes(page.slug))
    },
    { rmWhitespace: false }
  );
  writeFileSync(`${page.slug}.html`, html, "utf8");
  console.log(`Built: ${page.slug}.html`);
}

if (runningHeadphoneSpecifications) {
  const page = {
    ...runningHeadphoneSpecifications,
    datePublished: toIsoDate(runningHeadphoneSpecifications.published || runningHeadphoneSpecifications.updated),
    dateModified: toIsoDate(runningHeadphoneSpecifications.updated)
  };
  const html = ejs.render(
    specificationDatabaseTemplate,
    { page, allSections: sections, editorialProfile },
    { rmWhitespace: false }
  );
  writeFileSync(`${page.slug}.html`, trimLineEndWhitespace(html), "utf8");
  const csvColumns = [
    "Product",
    "Format",
    "Weight",
    "Single-charge battery",
    "Battery with case",
    "Quick charge",
    "Water resistance",
    "Controls",
    "Awareness approach",
    "Best running context",
    "Primary source"
  ];
  const csvRows = page.records.map((record) => [
    record.product,
    record.format,
    record.weight,
    record.singleChargeBattery,
    record.caseBattery,
    record.quickCharge,
    record.waterResistance,
    record.controls,
    record.awareness,
    record.bestUse,
    record.primarySource
  ]);
  const specificationCsv = [csvColumns, ...csvRows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
  mkdirSync("downloads", { recursive: true });
  writeFileSync("downloads/running-headphone-specifications.csv", specificationCsv, "utf8");
  writeFileSync("exports/running-headphone-specifications.csv", specificationCsv, "utf8");
  console.log(`Built: ${page.slug}.html`);
  console.log("Built: downloads/running-headphone-specifications.csv");
}

if (dataLab) {
  const page = {
    ...dataLab,
    datePublished: toIsoDate(dataLab.published || dataLab.updated),
    dateModified: toIsoDate(dataLab.updated)
  };
  const html = ejs.render(dataLabTemplate, { page, editorialProfile, allSections: sections }, { rmWhitespace: false });
  writeFileSync(`${page.slug}.html`, trimLineEndWhitespace(html), "utf8");
  console.log(`Built: ${page.slug}.html`);
}

if (gpsBatteryPlanner) {
  const page = {
    ...gpsBatteryPlanner,
    datePublished: toIsoDate(gpsBatteryPlanner.published || gpsBatteryPlanner.updated),
    dateModified: toIsoDate(gpsBatteryPlanner.updated)
  };
  const html = ejs.render(gpsBatteryPlannerTemplate, { page, editorialProfile, allSections: sections }, { rmWhitespace: false });
  writeFileSync(`${page.slug}.html`, trimLineEndWhitespace(html), "utf8");
  const csvColumns = ["Watch", "Mode", "Published maximum hours", "Mode fidelity", "Claim type", "Checked date", "Source label", "Source URL", "Important note"];
  const csvRows = page.modes.map((mode) => [mode.watchName, mode.modeLabel, mode.officialHours, mode.fidelityLabel, mode.claimType, mode.checkedDate, mode.sourceLabel, mode.sourceUrl, mode.note]);
  const csv = [csvColumns, ...csvRows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
  mkdirSync("downloads", { recursive: true });
  mkdirSync("exports", { recursive: true });
  writeFileSync("downloads/ultramarathon-gps-watch-battery-specifications.csv", csv, "utf8");
  writeFileSync("exports/ultramarathon-gps-watch-battery-specifications.csv", csv, "utf8");
  console.log(`Built: ${page.slug}.html`);
  console.log("Built: downloads/ultramarathon-gps-watch-battery-specifications.csv");
}

if (trailShoeMatrix) {
  const page = {
    ...trailShoeMatrix,
    datePublished: toIsoDate(trailShoeMatrix.published || trailShoeMatrix.updated),
    dateModified: toIsoDate(trailShoeMatrix.updated)
  };
  const html = ejs.render(trailShoeMatrixTemplate, { page, editorialProfile, allSections: sections }, { rmWhitespace: false });
  writeFileSync(`${page.slug}.html`, trimLineEndWhitespace(html), "utf8");
  const csvColumns = ["Product", "Model status", "Runnable / dry", "Mixed trail", "Rocky / technical", "Soft ground / mud", "Forefoot shape", "Midfoot / heel hold", "Cushion / protection", "Drop", "Distance bias", "Main fit caveat", "Confidence", "Primary evidence", "Primary source URL", "Secondary evidence", "Secondary source URL", "Checked date", "Phavai guide"];
  const csvRows = page.products.map((product) => [product.product, product.modelStatus, product.terrains.runnable, product.terrains.mixed, product.terrains.technical, product.terrains.mud, product.forefoot, product.hold, product.cushion, product.drop, product.distance, product.fitCaveat, product.confidence, product.sourceLabel, product.sourceUrl, product.secondarySourceLabel, product.secondarySourceUrl, product.checkedDate, `https://www.phavai.com${product.guideUrl}`]);
  const csv = [csvColumns, ...csvRows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
  mkdirSync("downloads", { recursive: true });
  mkdirSync("exports", { recursive: true });
  writeFileSync("downloads/trail-shoe-terrain-fit-matrix.csv", csv, "utf8");
  writeFileSync("exports/trail-shoe-terrain-fit-matrix.csv", csv, "utf8");
  console.log(`Built: ${page.slug}.html`);
  console.log("Built: downloads/trail-shoe-terrain-fit-matrix.csv");
}

if (todaysPicks) {
  const html = ejs.render(
    todaysPicksTemplate,
    {
      page: {
        ...todaysPicks,
        dateModified: toIsoDate(todaysPicks.updated)
      },
      allSections: sections,
      editorialProfile,
      affiliateConfig: AFFILIATE_CONFIG
    },
    { rmWhitespace: false }
  );
  writeFileSync(`${todaysPicks.slug}.html`, html, "utf8");
  console.log(`Built: ${todaysPicks.slug}.html`);
}

if (productIntelligence && maintenanceQueue) {
  const html = ejs.render(
    operatorDashboardTemplate,
    { dashboard: productIntelligence, maintenanceQueue, allSections: sections, searchExperiments },
    { rmWhitespace: false }
  );
  writeFileSync("operator-dashboard.html", html.replace(/[ \t]+$/gm, ""), "utf8");
  console.log("Built: operator-dashboard.html");
}

const staticPages = ["methodology.html", "editorial-standards.html", "about.html", "contact.html", "privacy.html", "terms.html"];
const urls = [
  { loc: "https://www.phavai.com/", changefreq: "weekly", priority: "1.0", lastmod: HOME_LAST_MODIFIED },
  ...sections.map((section) => ({
    loc: `https://www.phavai.com/${section.slug}.html`,
    changefreq: "weekly",
    priority: "0.9",
    lastmod: toIsoDate(section.updated)
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
  ...(runningHeadphoneSpecifications ? [{
    loc: `https://www.phavai.com/${runningHeadphoneSpecifications.slug}.html`,
    changefreq: "monthly",
    priority: "0.8",
    lastmod: toIsoDate(runningHeadphoneSpecifications.updated)
  }] : []),
  ...(dataLab ? [{
    loc: `https://www.phavai.com/${dataLab.slug}.html`,
    changefreq: "weekly",
    priority: "0.8",
    lastmod: toIsoDate(dataLab.updated)
  }] : []),
  ...(gpsBatteryPlanner ? [{
    loc: `https://www.phavai.com/${gpsBatteryPlanner.slug}.html`,
    changefreq: "monthly",
    priority: "0.8",
    lastmod: toIsoDate(gpsBatteryPlanner.updated)
  }] : []),
  ...(trailShoeMatrix ? [{
    loc: `https://www.phavai.com/${trailShoeMatrix.slug}.html`,
    changefreq: "monthly",
    priority: "0.8",
    lastmod: toIsoDate(trailShoeMatrix.updated)
  }] : []),
  ...(todaysPicks?.indexable !== false ? [{
    loc: `https://www.phavai.com/${todaysPicks.slug}.html`,
    changefreq: "daily",
    priority: "0.8",
    lastmod: toIsoDate(todaysPicks.updated)
  }] : []),
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
injectSiteIdentityTags();
console.log("Built: site identity tags");
injectStylesheetVersion();
console.log("Built: stylesheet version tags");
normalizeSiteNavigation();
console.log("Built: normalized navigation and skip links");
trimGeneratedHtml();
console.log("Built: HTML whitespace trim");
