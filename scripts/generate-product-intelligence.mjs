import { readFileSync, writeFileSync } from "node:fs";

const DATA_FILES = [
  { path: "data/categories.json", source: "core" },
  { path: "data/roundup-additions.json", source: "additions" },
  { path: "data/revenue-roundups.json", source: "revenue" }
];

const PRODUCT_DATABASE_PATH = "data/product-database.json";
const OPPORTUNITY_DASHBOARD_PATH = "data/ai-opportunity-dashboard.json";
const MAINTENANCE_QUEUE_PATH = "data/ai-maintenance-queue.json";
const GENERATED_AT = new Date().toISOString();
const TODAY = new Date();
const ONE_DAY_MS = 1000 * 60 * 60 * 24;

const evidenceOverrides = readOptionalJson("data/youtube-evidence-overrides.json", []);
const affiliateReport = readOptionalJson("exports/phavai-affiliate-readiness-report.json", { links: [] });
const sourceCoverage = readOptionalJson("data/source-coverage-report.json", { products: [] });
const qualityReport = readOptionalJson("data/quality-governance-report.json", {});
const searchConsole = readOptionalJson("data/search-console-tracking.json", []);

function readOptionalJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

function sourceKey(item) {
  return String(item.url || item.title || item.sourceName || "").trim().toLowerCase();
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

function sourceType(item) {
  if (item.source_type) return item.source_type;
  if (item.channel === "YouTube" || /youtube\.com|youtu\.be/i.test(item.url ?? "")) return "youtube";
  if (item.channel === "Reddit" || /reddit\.com/i.test(item.url ?? "")) return "reddit";
  return "expert";
}

function publicEvidence(item) {
  if (item.is_public === false) return false;
  if (!item.url) return false;
  if (/youtube\.com\/results|reddit\.com\/search/i.test(item.url)) return false;
  return true;
}

function daysSince(value) {
  if (!value) return 999;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 999;
  return Math.max(0, Math.round((TODAY - parsed) / ONE_DAY_MS));
}

function toDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function slugFromUrl(url = "") {
  return String(url).split("/").pop()?.replace(/\.html$/, "") ?? "";
}

function affiliateRowsFor(pageSlug, productName) {
  const rows = affiliateReport.issues ?? affiliateReport.links ?? affiliateReport.rows ?? [];
  return rows.filter((row) => {
    const pageMatches = [row.page, row.guide, row.url, row.sourcePage]
      .filter(Boolean)
      .some((value) => String(value).includes(pageSlug));
    const productMatches = [row.product, row.productName, row.product_name, row.anchorText]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(productName.toLowerCase()));
    return pageMatches || productMatches;
  });
}

function affiliateStatus(category, product) {
  const url = product.affiliateUrl ?? "";
  const rows = affiliateRowsFor(category.slug, product.name);
  const flagged = rows.some((row) => /need|missing|search|not ready|not an exact/i.test(`${row.status ?? ""} ${row.notes ?? ""} ${row.issue ?? ""}`));

  if (flagged) return "needs_exact_product_url";
  if (/amazon\.com/i.test(url) || product.shoppingLinks?.some((link) => /amazon\.com/i.test(link.url ?? ""))) return "ready";
  return url ? "non_amazon_or_manual" : "missing_shopping_link";
}

function coverageFor(category, product) {
  return sourceCoverage.products?.find((row) => row.page === category.slug && row.product === product.name);
}

function buildProductRecord(category, product, dataSource) {
  const evidence = mergeEvidence(product, category).filter(publicEvidence);
  const counts = {
    expert: evidence.filter((item) => sourceType(item) === "expert").length,
    youtube: evidence.filter((item) => sourceType(item) === "youtube").length,
    reddit: evidence.filter((item) => sourceType(item) === "reddit").length,
    total: evidence.length
  };
  const coverage = coverageFor(category, product);
  const missingChannels = coverage?.missingChannels ?? [
    ...(!counts.expert ? ["Expert"] : []),
    ...(!counts.youtube ? ["YouTube"] : []),
    ...(!counts.reddit ? ["Reddit"] : [])
  ];
  const thinChannels = coverage?.thinChannels ?? [
    ...(counts.expert === 1 ? ["Expert"] : []),
    ...(counts.youtube === 1 ? ["YouTube"] : []),
    ...(counts.reddit === 1 ? ["Reddit"] : [])
  ];

  const sourceGapScore =
    missingChannels.length * 14 +
    thinChannels.length * 6 +
    Math.max(0, 6 - counts.total) * 2;
  const affiliate = affiliateStatus(category, product);
  const affiliateScore = affiliate === "ready" ? 0 : affiliate === "needs_exact_product_url" ? 12 : 8;
  const freshnessScore = daysSince(category.updated) > 90 ? 10 : daysSince(category.updated) > 45 ? 5 : 0;
  const revenueBoost = dataSource === "revenue" ? 8 : 0;
  const score = sourceGapScore + affiliateScore + freshnessScore + revenueBoost;

  return {
    id: `${category.slug}::${product.name}`,
    product: product.name,
    page: category.slug,
    pageTitle: category.title,
    section: category.sectionSlug,
    dataSource,
    rank: product.rank ?? null,
    tag: product.tag ?? "",
    bestFor: product.bestFor ?? "",
    avoidIf: product.avoidIf ?? "",
    affiliateUrl: product.affiliateUrl ?? "",
    affiliateStatus: affiliate,
    evidenceCounts: counts,
    missingChannels,
    thinChannels,
    updated: category.updated,
    daysSinceUpdated: daysSince(category.updated),
    opportunityScore: score,
    recommendedActions: recommendedProductActions({ counts, missingChannels, thinChannels, affiliate, category, product })
  };
}

function recommendedProductActions({ counts, missingChannels, thinChannels, affiliate, category, product }) {
  const actions = [];
  if (missingChannels.includes("Expert")) actions.push("Find one exact hands-on expert review.");
  if (thinChannels.includes("Expert")) actions.push("Add a second expert source to support the recommendation.");
  if (missingChannels.includes("YouTube")) actions.push("Find an exact YouTube review with visible product use.");
  if (thinChannels.includes("YouTube")) actions.push("Add another exact YouTube review or comparison video.");
  if (missingChannels.includes("Reddit")) actions.push("Find one exact owner discussion thread.");
  if (thinChannels.includes("Reddit")) actions.push("Add another owner discussion, ideally with long-term use or fit complaints.");
  if (counts.total < 4) actions.push("Raise public evidence depth to at least four useful sources.");
  if (affiliate === "needs_exact_product_url") actions.push("Replace Amazon search/generic link with an exact product URL.");
  if (affiliate === "needs_affiliate_tag") actions.push("Add the configured Amazon affiliate tag.");
  if (category.sourceWeights?.Expert === 100 && (counts.youtube || counts.reddit)) {
    actions.push("Keep non-expert evidence visible while preserving expert-only scoring.");
  }
  if (!actions.length && product.affiliateUrl) actions.push("Monitor clicks and refresh if rankings or product availability change.");
  return actions;
}

function pageSearchConsole(pageSlug) {
  const records = Array.isArray(searchConsole)
    ? searchConsole
    : (searchConsole.live_pages ?? searchConsole.pages ?? searchConsole.records ?? []);
  return records.find((row) => slugFromUrl(row.url ?? row.path ?? "") === pageSlug) ?? {};
}

function searchOpportunityScore(search) {
  const impressions = Number(search.impressions);
  const clicks = Number(search.clicks);
  const position = Number(search.position);
  if (!Number.isFinite(impressions) || impressions <= 0) return 0;

  let score = Math.min(30, Math.round(Math.log10(impressions + 1) * 8));
  if (position >= 8 && position <= 30) score += 35;
  else if (position > 30 && position <= 60) score += 18;
  else if (position > 0 && position < 8) score += 12;
  if (clicks === 0 && impressions >= 100) score += 8;
  return score;
}

function pageRecord(category, products, dataSource) {
  const pageProducts = products.filter((row) => row.page === category.slug);
  const sourceGapTotal = pageProducts.reduce((total, product) => total + product.missingChannels.length + product.thinChannels.length, 0);
  const affiliateIssues = pageProducts.filter((product) => product.affiliateStatus !== "ready").length;
  const searchRecord = pageSearchConsole(category.slug);
  const search = searchRecord.search_metrics ?? searchRecord;
  const hasSearchData = [search.impressions, search.clicks, search.position].some((value) => Number.isFinite(Number(value)));
  const searchScore = searchOpportunityScore(search);
  const contentMaintenanceScore = Math.round(
    pageProducts.reduce((total, product) => total + product.opportunityScore, 0) / Math.max(1, pageProducts.length)
  );
  const opportunityScore =
    contentMaintenanceScore +
    (dataSource === "revenue" ? 10 : 0) +
    (searchScore * 3);

  return {
    page: category.slug,
    title: category.title,
    section: category.sectionSlug,
    dataSource,
    updated: category.updated,
    daysSinceUpdated: daysSince(category.updated),
    productCount: pageProducts.length,
    sourceGapTotal,
    affiliateIssues,
    sourceCompleteProducts: pageProducts.filter((product) => !product.missingChannels.length && !product.thinChannels.length).length,
    averageEvidenceCount: Number((pageProducts.reduce((total, product) => total + product.evidenceCounts.total, 0) / Math.max(1, pageProducts.length)).toFixed(1)),
    contentMaintenanceScore,
    searchSignal: {
      primaryQuery: search.primary_query ?? search.query ?? "",
      impressions: search.impressions ?? null,
      clicks: search.clicks ?? null,
      ctr: search.ctr ?? null,
      position: search.position ?? null,
      topQueries: search.top_queries ?? []
    },
    searchOpportunityScore: searchScore,
    opportunityScore,
    recommendedActions: recommendedPageActions(category, pageProducts, affiliateIssues, sourceGapTotal, hasSearchData, search)
  };
}

function recommendedPageActions(category, products, affiliateIssues, sourceGapTotal, hasSearchData, search) {
  const actions = [];
  if (Number(search.impressions) >= 100 && Number(search.position) >= 8 && Number(search.position) <= 30) {
    actions.push("Prioritize this page: it already has meaningful impressions within striking distance of page one.");
  } else if (Number(search.impressions) >= 250) {
    actions.push("Improve the title, opening answer, internal links, and original evidence for this visible search page.");
  }
  if (sourceGapTotal) actions.push("Run source curation on the highest-gap products.");
  if (affiliateIssues) actions.push("Fix affiliate links before expanding traffic to this page.");
  if (category.sourceWeights?.Expert === 100 && products.some((product) => product.evidenceCounts.youtube || product.evidenceCounts.reddit)) {
    actions.push("Keep supplemental YouTube/Reddit visible without changing ranking weights.");
  }
  if (!hasSearchData) actions.push("Map this page to Search Console query tracking.");
  if (daysSince(category.updated) > 60) actions.push("Refresh intro, product availability, and changed-model notes.");
  if (!actions.length) actions.push("Use this page as a template for a comparison or alternative page.");
  return actions;
}

function taskPriority(product) {
  if (product.affiliateStatus !== "ready") return "high";
  if (product.missingChannels.includes("Expert")) return "high";
  if (product.opportunityScore >= 40) return "high";
  if (product.missingChannels.length || product.thinChannels.length >= 2) return "medium";
  return "low";
}

const categories = [];
for (const file of DATA_FILES) {
  const data = readOptionalJson(file.path, []);
  for (const category of data) categories.push({ category, dataSource: file.source });
}

const products = categories.flatMap(({ category, dataSource }) => {
  return (category.products ?? []).map((product) => buildProductRecord(category, product, dataSource));
});

const uniqueProducts = new Map();
for (const product of products) {
  const current = uniqueProducts.get(product.product);
  if (!current || product.opportunityScore > current.opportunityScore) uniqueProducts.set(product.product, product);
}

const pages = categories.map(({ category, dataSource }) => pageRecord(category, products, dataSource));
const tasks = products
  .filter((product) => product.opportunityScore >= 12 || product.affiliateStatus !== "ready")
  .sort((a, b) => b.opportunityScore - a.opportunityScore)
  .slice(0, 80)
  .map((product, index) => ({
    id: `task-${String(index + 1).padStart(3, "0")}`,
    priority: taskPriority(product),
    page: product.page,
    product: product.product,
    opportunityScore: product.opportunityScore,
    action: product.recommendedActions[0] ?? "Review product manually.",
    followUps: product.recommendedActions.slice(1, 4)
  }));

const dashboard = {
  generatedAt: GENERATED_AT,
  summary: {
    pages: pages.length,
    productPlacements: products.length,
    uniqueProducts: uniqueProducts.size,
    readyAffiliateProducts: products.filter((product) => product.affiliateStatus === "ready").length,
    productsMissingExpert: products.filter((product) => product.missingChannels.includes("Expert")).length,
    productsMissingYouTube: products.filter((product) => product.missingChannels.includes("YouTube")).length,
    productsMissingReddit: products.filter((product) => product.missingChannels.includes("Reddit")).length,
    highPriorityTasks: tasks.filter((task) => task.priority === "high").length
  },
  topPages: pages.sort((a, b) => b.opportunityScore - a.opportunityScore).slice(0, 18),
  topProducts: products.sort((a, b) => b.opportunityScore - a.opportunityScore).slice(0, 24),
  systems: [
    {
      name: "Source refresh",
      status: dashboardStatus(tasks.some((task) => /source|review|discussion|youtube/i.test(task.action))),
      nextStep: "Run source curation, then approve exact URLs before build."
    },
    {
      name: "Affiliate link health",
      status: dashboardStatus(products.some((product) => product.affiliateStatus !== "ready")),
      nextStep: "Replace generic Amazon links and keep the Associate tag on every shopping URL."
    },
    {
      name: "Today's Picks",
      status: "ready",
      nextStep: "Rotate products from submitted links or seasonal opportunities."
    },
    {
      name: "Revenue feedback",
      status: "needs-data",
      nextStep: "Connect click/conversion data to this report once tracking exports are available."
    }
  ]
};

function dashboardStatus(hasIssues) {
  return hasIssues ? "needs-attention" : "ready";
}

writeFileSync(PRODUCT_DATABASE_PATH, JSON.stringify({
  generatedAt: GENERATED_AT,
  products
}, null, 2) + "\n", "utf8");

writeFileSync(OPPORTUNITY_DASHBOARD_PATH, JSON.stringify(dashboard, null, 2) + "\n", "utf8");

writeFileSync(MAINTENANCE_QUEUE_PATH, JSON.stringify({
  generatedAt: GENERATED_AT,
  tasks
}, null, 2) + "\n", "utf8");

console.log(`Wrote ${PRODUCT_DATABASE_PATH} for ${products.length} product placements.`);
console.log(`Wrote ${OPPORTUNITY_DASHBOARD_PATH} with ${dashboard.summary.highPriorityTasks} high-priority tasks.`);
console.log(`Wrote ${MAINTENANCE_QUEUE_PATH} with ${tasks.length} tasks.`);
