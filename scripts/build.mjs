import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import ejs from "ejs";

const categories = JSON.parse(readFileSync("data/categories.json", "utf8").replace(/^\uFEFF/, ""));
const sections = JSON.parse(readFileSync("data/sections.json", "utf8").replace(/^\uFEFF/, ""));
const supportingPages = JSON.parse(readFileSync("data/supporting.json", "utf8").replace(/^\uFEFF/, ""));
const imageSources = JSON.parse(readFileSync("data/image-sources.json", "utf8").replace(/^\uFEFF/, ""));
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

const ONE_MONTH_MS = 1000 * 60 * 60 * 24 * 30.4375;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function firstEnv(...names) {
  return names.map((name) => process.env[name]).find((value) => value && value.trim())?.trim() ?? "";
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
        topEvidence: evidence.sort((a, b) => b.evidenceWeight - a.evidenceWeight)[0],
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
  const channelScores = buildChannelScores(product, category);
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
    ...product,
    imageInfo,
    sourceScores: channelScores,
    rawBestPickScore: Number(rawScore.toFixed(1)),
    bestPickScore: Math.round(rawScore),
    consensus: Math.round(clamp(100 - disagreement * 4, 0, 100)),
    signal,
    evidenceCount: product.evidence.length
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
  const products = category.products
    .map((product) => computeProductScores(product, { ...category, sourceWeights }))
    .sort((a, b) => {
      if (b.bestPickScore !== a.bestPickScore) return b.bestPickScore - a.bestPickScore;
      if (b.consensus !== a.consensus) return b.consensus - a.consensus;
      return b.signal - a.signal;
    })
    .map((product, index) => ({ ...product, rank: index + 1 }));

  return { ...category, section: sectionsBySlug.get(category.sectionSlug), sourceWeights, products };
});

for (const category of builtCategories) {
  const relatedReviewOrder = new Map((category.relatedReviewSlugs ?? []).map((slug, index) => [slug, index]));
  const relatedReviews = builtCategories
    .filter((review) => review.sectionSlug === category.sectionSlug && review.slug !== category.slug)
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
      supportingPages: supportBySection.get(category.sectionSlug) ?? []
    },
    { rmWhitespace: false }
  );
  writeFileSync(`${category.slug}.html`, html, "utf8");
  console.log(`Built: ${category.slug}.html`);
}

for (const section of sections) {
  const reviews = builtCategories.filter((category) => category.sectionSlug === section.slug);
  const html = ejs.render(
    sectionTemplate,
    {
      section,
      reviews,
      supportingPages: supportBySection.get(section.slug) ?? [],
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
  { loc: "https://www.phavai.com/", changefreq: "weekly", priority: "1.0" },
  ...sections.map((section) => ({
    loc: `https://www.phavai.com/${section.slug}.html`,
    changefreq: "weekly",
    priority: "0.9"
  })),
  ...builtCategories.map((category) => ({
    loc: `https://www.phavai.com/${category.slug}.html`,
    changefreq: "weekly",
    priority: "0.8"
  })),
  ...supportingPages.map((page) => ({
    loc: `https://www.phavai.com/${page.slug}.html`,
    changefreq: "monthly",
    priority: "0.7"
  })),
  ...staticPages.map((page) => ({
    loc: `https://www.phavai.com/${page}`,
    changefreq: page === "privacy.html" || page === "terms.html" ? "yearly" : "monthly",
    priority: page === "methodology.html" ? "0.7" : "0.5"
  }))
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url>
    <loc>${url.loc}</loc>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`).join("\n")}
</urlset>
`;
writeFileSync("sitemap.xml", sitemap, "utf8");
console.log("Built: sitemap.xml");
injectMeasurementTags();
console.log("Built: measurement tags");
