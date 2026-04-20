import { readFileSync, writeFileSync } from "node:fs";
import ejs from "ejs";

const categories = JSON.parse(readFileSync("data/categories.json", "utf8").replace(/^\uFEFF/, ""));
const categoryTemplate = readFileSync("templates/category.ejs", "utf8");

const DEFAULT_SOURCE_WEIGHTS = {
  Expert: 40,
  YouTube: 20,
  Reddit: 20,
  Social: 20
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
    sourceScores: channelScores,
    rawBestPickScore: Number(rawScore.toFixed(1)),
    bestPickScore: Math.round(rawScore),
    consensus: Math.round(clamp(100 - disagreement * 4, 0, 100)),
    signal,
    evidenceCount: product.evidence.length
  };
}

for (const category of categories) {
  const sourceWeights = category.sourceWeights ?? DEFAULT_SOURCE_WEIGHTS;
  const products = category.products
    .map((product) => computeProductScores(product, { ...category, sourceWeights }))
    .sort((a, b) => {
      if (b.bestPickScore !== a.bestPickScore) return b.bestPickScore - a.bestPickScore;
      if (b.consensus !== a.consensus) return b.consensus - a.consensus;
      return b.signal - a.signal;
    })
    .map((product, index) => ({ ...product, rank: index + 1 }));

  const html = ejs.render(
    categoryTemplate,
    { ...category, sourceWeights, products },
    { rmWhitespace: false }
  );
  writeFileSync(`${category.slug}.html`, html, "utf8");
  console.log(`Built: ${category.slug}.html`);
}
