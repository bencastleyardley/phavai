import { readFileSync, writeFileSync } from "node:fs";

const categories = [
  ...JSON.parse(readFileSync("data/categories.json", "utf8").replace(/^\uFEFF/, "")),
  ...readOptionalJson("data/roundup-additions.json", [])
];

function readOptionalJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

function channelOf(item) {
  if (item.channel) return item.channel;
  if (item.source_type === "youtube") return "YouTube";
  if (item.source_type === "reddit") return "Reddit";
  return "Expert";
}

function polarityOf(item) {
  if (item.evidence_polarity === "caution") return "caution";
  if (item.evidence_polarity === "positive" || item.evidence_polarity === "mixed") return "positive";
  return Number(item.score) <= 83 ? "caution" : "positive";
}

function countBy(items, predicate) {
  return items.filter(predicate).length;
}

const productReports = [];

for (const category of categories) {
  for (const product of category.products ?? []) {
    const publicEvidence = (product.evidence ?? []).filter((item) => item.is_public !== false);
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
