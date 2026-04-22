import { readFileSync, writeFileSync } from "node:fs";

const categoriesPath = "data/categories.json";
const categories = JSON.parse(readFileSync(categoriesPath, "utf8").replace(/^\uFEFF/, ""));

function polishDescription(value = "") {
  return value
    .replace(/^A transparent ranking of /, "A practical guide to ")
    .replace(/^Best /, "Best ")
    .replace(/, review consensus, and confidence indicators\./, ", fit notes, and real-world tradeoffs.")
    .replace(/Compare top picks by BestPick Score, source breakdowns, consensus, pros, tradeoffs, and buyer-fit guidance\./g, "Compare the best picks by fit, use case, tradeoffs, source agreement, and buyer-fit guidance.")
    .replace(/ranked with BestPick Scores, consensus signals, source breakdowns, pros, tradeoffs, and avoid-if guidance\./g, "ranked by comfort, fit security, durability, source agreement, tradeoffs, and skip-if guidance.")
    .replace(/ranked by grip, foothold, protection, source consensus, and Phavai BestPick Score\./g, "ranked by grip, foothold, protection, confidence, and real terrain tradeoffs.");
}

function polishComparison(value = "") {
  if (value.includes("Compare the ranked picks by best use case")) {
    return "Compare the shortlist by use case, score, source agreement, evidence depth, and the main reason each pick might be wrong for you.";
  }

  return value
    .replace(/consensus/g, "source agreement")
    .replace(/signal strength/g, "evidence depth")
    .replace(/detailed evidence/g, "source notes");
}

function polishSourceReason(value = "") {
  if (!value) return value;
  if (value.includes("Trail running uses three auditable evidence channels")) {
    return "Trail gear gets weighted toward specialist reviews, then balanced with creator field use and runner-owner feedback. We keep social media out until it can be collected cleanly.";
  }
  if (value.includes("This category uses three auditable evidence channels")) {
    return "The default ranking gives expert reviews the most weight, then balances that with creator use and owner feedback. We keep broad social media out until it can be collected cleanly.";
  }
  return value
    .replace(/auditable evidence channels/g, "review channels")
    .replace(/Broad social media is excluded until Phavai has a reliable API-backed collection process\./g, "Broad social media stays out until it can be collected cleanly.")
    .replace(/Social is excluded until Phavai has a reliable API-backed collection process\./g, "Social media stays out until it can be collected cleanly.");
}

function polishFaq(value = "") {
  return value
    .replace(/Phavai rolls individual evidence items into Expert, YouTube, and Reddit channel scores, then applies the category weights shown on the page\. The final rank also shows consensus and signal strength so shoppers can separate popularity from confidence\./g, "Phavai blends expert reviews, creator testing, and owner feedback into a default pick order. We also show source agreement and evidence depth so you can see whether a recommendation is broadly supported or more specialized.")
    .replace(/No\. No\. Retail-link availability does not influence/g, "No. Retail-link availability does not influence")
    .replace(/Shopping-link availability is not an input in the BestPick Score\. Product links are provided for convenience, while rankings are based on evidence quality, consensus, and signal strength\./g, "Retail-link availability does not influence the pick order. Product links are provided for convenience, while rankings are based on fit, evidence quality, source agreement, and real-world tradeoffs.")
    .replace(/signal and consensus values/g, "evidence and source-agreement values")
    .replace(/A high BestPick means/g, "A high pick score means");
}

for (const category of categories) {
  category.description = polishDescription(category.description);
  category.metaDescription = polishDescription(category.metaDescription);
  category.metaTitle = `${category.title} | Phavai Buying Guide`;
  category.schemaName = category.schemaName?.replace("ranked by Phavai BestPick Score", "recommended by Phavai");
  category.comparisonIntro = polishComparison(category.comparisonIntro);
  category.sourceWeightReason = polishSourceReason(category.sourceWeightReason);

  if (Array.isArray(category.faqs)) {
    for (const faq of category.faqs) {
      faq.answer = polishFaq(faq.answer);
    }
  }

  for (const product of category.products ?? []) {
    if (/earns its position as .*score blends/.test(product.verdict ?? "")) {
      const strengths = (product.pros ?? []).slice(0, 2).map((item) => item.toLowerCase());
      const strengthText = strengths.length > 1 ? `${strengths[0]} and ${strengths[1]}` : strengths[0] ?? "a strong all-around profile";
      product.verdict = `${product.name} is the ${product.tag.toLowerCase()} for shoppers who want ${product.bestFor.toLowerCase()}. It stands out for ${strengthText}, with tradeoffs worth weighing.`;
    } else {
      product.verdict = product.verdict
        ?.replace(/earns a place/g, "belongs here")
        .replace(/broader consensus/g, "broader agreement")
        .replace(/expert, creator, and community signals/g, "expert reviews, creator use, and owner feedback");
    }
  }
}

writeFileSync(categoriesPath, `${JSON.stringify(categories, null, 2)}\n`, "utf8");
console.log(`Polished ${categories.length} review pages.`);
