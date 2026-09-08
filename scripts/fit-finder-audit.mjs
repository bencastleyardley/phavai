import { existsSync, readFileSync } from "node:fs";

function readJson(path, fallback = []) {
  try {
    return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

const categories = [
  ...readJson("data/categories.json"),
  ...readJson("data/roundup-additions.json"),
  ...readJson("data/revenue-roundups.json")
];

const categoriesWithAuthoredFitFinder = new Set([
  "best-mens-trail-running-shoes",
  "best-womens-trail-running-shoes",
  "best-trail-running-poles",
  "best-standing-desks",
  "best-carry-on-luggage"
]);

const issues = [];

for (const category of categories) {
  const file = `${category.slug}.html`;
  if (!existsSync(file)) {
    issues.push({ page: file, issue: "Missing built roundup page" });
    continue;
  }

  const html = readFileSync(file, "utf8");
  const productCount = category.products?.length ?? 0;
  const fitProfileCount = (html.match(/data-fit-profile=/g) ?? []).length;
  const proofSnapshotCount = (html.match(/class="proof-snapshot-grid"/g) ?? []).length;
  const expectsFitFinder = categoriesWithAuthoredFitFinder.has(category.slug);

  if (!html.includes('src="/fit-finder.js"')) {
    issues.push({ page: file, issue: "Missing fit-finder.js script" });
  }
  if (expectsFitFinder && !html.includes("data-fit-finder")) {
    issues.push({ page: file, issue: "Missing public fit finder" });
  }
  if (expectsFitFinder && !html.includes("Find your fit")) {
    issues.push({ page: file, issue: "Missing fit finder label" });
  }
  if (expectsFitFinder && fitProfileCount !== productCount) {
    issues.push({ page: file, issue: `Expected ${productCount} fit profiles, found ${fitProfileCount}` });
  }
  if (!expectsFitFinder && (html.includes("data-fit-finder") || fitProfileCount > 0)) {
    issues.push({ page: file, issue: "Generic fit finder or fit profiles are present without category-specific logic" });
  }
  if (proofSnapshotCount < productCount) {
    issues.push({ page: file, issue: `Expected ${productCount} proof snapshots, found ${proofSnapshotCount}` });
  }
  if (expectsFitFinder && productCount >= 3 && (html.match(/data-fit-card/g) ?? []).length < 3) {
    issues.push({ page: file, issue: "Missing fit shortlist cards" });
  }
}

if (issues.length) {
  console.error(`Fit finder audit found ${issues.length} issue(s).`);
  for (const issue of issues.slice(0, 30)) {
    console.error(`- ${issue.page}: ${issue.issue}`);
  }
  process.exit(1);
}

console.log(`Fit finder audit passed for ${categories.length} roundup pages; ${categoriesWithAuthoredFitFinder.size} use category-specific fit logic.`);
