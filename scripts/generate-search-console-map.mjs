import { readFileSync, writeFileSync } from "node:fs";

const categories = JSON.parse(readFileSync("data/categories.json", "utf8").replace(/^\uFEFF/, ""));
const sections = JSON.parse(readFileSync("data/sections.json", "utf8").replace(/^\uFEFF/, ""));
const supportingPages = JSON.parse(readFileSync("data/supporting.json", "utf8").replace(/^\uFEFF/, ""));
const roadmap = JSON.parse(readFileSync("data/content-roadmap.json", "utf8").replace(/^\uFEFF/, ""));

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function queryFromTitle(title) {
  return title
    .replace(/\s+\|\s+Phavai.*$/i, "")
    .replace(/^How Phavai Chooses Products$/i, "phavai methodology")
    .trim()
    .toLowerCase();
}

function pageRecord({ path, title, type, sectionSlug = "", cluster = "", status = "live", priority = 5, intent = "commercial investigation", updated = "2026-04-22", related = [] }) {
  const url = path === "/" ? "https://www.phavai.com/" : `https://www.phavai.com/${path.replace(/^\//, "")}`;
  return {
    status,
    url,
    path,
    title,
    page_type: type,
    section_slug: sectionSlug,
    cluster,
    priority,
    primary_query: queryFromTitle(title),
    secondary_query_patterns: [
      `${queryFromTitle(title)} reviews`,
      `${queryFromTitle(title)} buying guide`,
      `${queryFromTitle(title)} recommendations`
    ],
    search_intent: intent,
    last_updated: updated,
    related_paths: related,
    gsc_metrics_to_monitor: [
      "clicks",
      "impressions",
      "ctr",
      "average_position",
      "top_queries",
      "landing_page"
    ]
  };
}

const sectionBySlug = new Map(sections.map((section) => [section.slug, section]));
const livePages = [
  pageRecord({
    path: "/",
    title: "Stop digging. Start deciding.",
    type: "homepage",
    priority: 1,
    intent: "brand navigation",
    related: sections.map((section) => `/${section.slug}.html`)
  }),
  ...sections.map((section) => pageRecord({
    path: `/${section.slug}.html`,
    title: `${section.title} Reviews`,
    type: "category_hub",
    sectionSlug: section.slug,
    cluster: section.title,
    priority: 2,
    intent: "category browsing",
    related: categories.filter((category) => category.sectionSlug === section.slug).map((category) => `/${category.slug}.html`)
  })),
  ...categories.map((category) => pageRecord({
    path: `/${category.slug}.html`,
    title: category.title,
    type: "roundup_review",
    sectionSlug: category.sectionSlug,
    cluster: sectionBySlug.get(category.sectionSlug)?.title ?? "",
    priority: category.slug.includes("trail") || category.slug.includes("standing") || category.slug.includes("office") || category.slug.includes("air-purifier") ? 1 : 3,
    intent: "best product commercial investigation",
    updated: category.updated,
    related: [
      `/${category.sectionSlug}.html`,
      ...(category.relatedReviewSlugs ?? []).slice(0, 5).map((slug) => `/${slug}.html`)
    ]
  })),
  ...supportingPages.map((page) => pageRecord({
    path: `/${page.slug}.html`,
    title: page.title,
    type: page.type.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
    sectionSlug: page.sectionSlug,
    cluster: sectionBySlug.get(page.sectionSlug)?.title ?? "",
    priority: 4,
    intent: page.type.toLowerCase().includes("comparison") ? "comparison investigation" : "informational buyer help",
    updated: page.updated,
    related: page.relatedReviewSlugs.map((slug) => `/${slug}.html`)
  })),
  ...["methodology.html", "editorial-standards.html", "about.html", "contact.html", "privacy.html", "terms.html"].map((path) => pageRecord({
    path: `/${path}`,
    title: path.replace(".html", "").replace(/-/g, " "),
    type: "trust_or_utility",
    priority: path === "methodology.html" || path === "editorial-standards.html" ? 3 : 6,
    intent: "trust validation"
  }))
];

const liveSlugs = new Set(categories.map((category) => category.title.toLowerCase()));
const plannedOpportunities = roadmap.clusters.flatMap((cluster) => {
  return ["core_roundups", "use_cases", "comparisons", "buyer_help"].flatMap((type) => {
    return (cluster[type] ?? [])
      .filter((title) => !liveSlugs.has(title.toLowerCase()))
      .map((title, index) => ({
        status: "planned",
        title,
        proposed_slug: slugify(title),
        page_type: type,
        cluster: cluster.name,
        section_slug: cluster.site_section,
        priority: cluster.priority + index / 100,
        primary_query: queryFromTitle(title),
        internal_link_targets: [
          `/${cluster.site_section}.html`
        ],
        gsc_trigger: "Build when related live pages gain impressions, when GSC shows query impressions without a matching page, or when the cluster needs a comparison/use-case support page."
      }));
  });
}).sort((a, b) => a.priority - b.priority);

writeFileSync("data/search-console-tracking.json", `${JSON.stringify({
  generated_at: new Date().toISOString(),
  purpose: "Landing-page and query map for joining Google Search Console exports with Phavai content priorities.",
  live_page_count: livePages.length,
  planned_opportunity_count: plannedOpportunities.length,
  live_pages: livePages,
  planned_opportunities: plannedOpportunities
}, null, 2)}\n`, "utf8");

console.log(`Wrote ${livePages.length} live page records and ${plannedOpportunities.length} planned opportunities.`);
