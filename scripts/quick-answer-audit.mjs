import { existsSync, readFileSync } from "node:fs";

function readJson(path, fallback = null) {
  try {
    return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

const categories = [
  ...readJson("data/categories.json", []),
  ...readJson("data/roundup-additions.json", []),
  ...readJson("data/revenue-roundups.json", [])
];
const sections = readJson("data/sections.json", []);
const supportingPages = readJson("data/supporting.json", []);
const todaysPicks = readJson("data/todays-picks.json", null);

const expectedPages = [
  ...categories.map((page) => ({ slug: page.slug, type: "roundup", needsShoppingCta: true })),
  ...sections.map((page) => ({ slug: page.slug, type: "section hub", needsShoppingCta: false })),
  ...supportingPages.map((page) => ({ slug: page.slug, type: "supporting guide", needsShoppingCta: false })),
  ...(todaysPicks?.indexable !== false ? [{ slug: todaysPicks.slug, type: "today's picks", needsShoppingCta: true }] : [])
];

const seen = new Set();
const issues = [];
let shoppingQuickAnswers = 0;

for (const page of expectedPages) {
  if (seen.has(page.slug)) {
    issues.push({ slug: page.slug, issue: "Duplicate expected page slug" });
    continue;
  }
  seen.add(page.slug);

  const path = `${page.slug}.html`;
  if (!existsSync(path)) {
    issues.push({ slug: page.slug, type: page.type, issue: "Missing built HTML file" });
    continue;
  }

  const html = readFileSync(path, "utf8");
  if (page.type === "section hub") {
    const startingPanel = html.match(/<section class="collection-start-panel"[\s\S]*?<\/section>/)?.[0] ?? "";
    const guideLinkCount = (startingPanel.match(/data-guide-link/g) ?? []).length;
    if (!startingPanel || guideLinkCount < 3) {
      issues.push({ slug: page.slug, type: page.type, issue: "Missing three-guide starting panel" });
    }
    if (startingPanel.includes("data-affiliate-link")) {
      issues.push({ slug: page.slug, type: page.type, issue: "Section starting panel should not make a universal retailer recommendation" });
    }
    continue;
  }

  const quickAnswerIndex = html.indexOf("data-quick-answer");
  if (quickAnswerIndex === -1) {
    issues.push({ slug: page.slug, type: page.type, issue: "Missing data-quick-answer block" });
    continue;
  }

  const quickAnswerEnd = html.indexOf("</section>", quickAnswerIndex);
  const quickAnswerBlock = html.slice(quickAnswerIndex, quickAnswerEnd === -1 ? undefined : quickAnswerEnd);
  if (!quickAnswerBlock.includes("Quick answer")) {
    issues.push({ slug: page.slug, type: page.type, issue: "Quick answer block missing heading label" });
  }

  if (quickAnswerBlock.includes("data-affiliate-link")) {
    shoppingQuickAnswers += 1;
  } else if (page.needsShoppingCta && !quickAnswerBlock.includes("shopping-link-status")) {
    issues.push({ slug: page.slug, type: page.type, issue: "Quick answer block missing shopping CTA" });
  }
}

if (issues.length) {
  console.error(`Quick answer audit found ${issues.length} issue(s).`);
  for (const issue of issues) {
    console.error(`- ${issue.slug} (${issue.type || "unknown"}): ${issue.issue}`);
  }
  process.exit(1);
}

console.log(`Quick answer audit checked ${expectedPages.length} recommendation pages.`);
console.log(`Quick answer shopping CTAs found on ${shoppingQuickAnswers} pages.`);
