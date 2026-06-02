import { readFileSync } from "node:fs";

const PRODUCT_DATABASE_PATH = "data/product-database.json";
const DASHBOARD_PATH = "data/ai-opportunity-dashboard.json";
const QUEUE_PATH = "data/ai-maintenance-queue.json";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function fail(message) {
  console.error(`Product intelligence audit failed: ${message}`);
  process.exitCode = 1;
}

const database = readJson(PRODUCT_DATABASE_PATH);
const dashboard = readJson(DASHBOARD_PATH);
const queue = readJson(QUEUE_PATH);

const products = database.products ?? [];
const tasks = queue.tasks ?? [];
const summary = dashboard.summary ?? {};
const allowedAffiliateStatuses = new Set([
  "ready",
  "needs_exact_product_url",
  "non_amazon_or_manual",
  "missing_shopping_link"
]);

if (products.length < 200) fail(`expected at least 200 product placements, found ${products.length}`);
if ((summary.pages ?? 0) < 50) fail(`expected at least 50 product pages, found ${summary.pages ?? 0}`);
if ((summary.productPlacements ?? 0) !== products.length) fail("summary productPlacements does not match database");
if ((summary.highPriorityTasks ?? 0) < 1) fail("expected at least one high-priority task");
if (!dashboard.topPages?.length) fail("dashboard is missing top page opportunities");
if (!dashboard.topProducts?.length) fail("dashboard is missing top product opportunities");
if (!dashboard.systems?.length) fail("dashboard is missing system status rows");
if (tasks.length < 40) fail(`expected at least 40 queue tasks, found ${tasks.length}`);

for (const product of products) {
  if (!product.product || !product.page) fail("product database contains an unnamed product or page");
  if (!allowedAffiliateStatuses.has(product.affiliateStatus)) fail(`unexpected affiliate status: ${product.affiliateStatus}`);
  if (typeof product.evidenceCounts?.total !== "number") fail(`missing evidence counts for ${product.product}`);
  if (!Array.isArray(product.recommendedActions) || !product.recommendedActions.length) {
    fail(`missing recommended actions for ${product.product}`);
  }
}

for (const task of tasks) {
  if (!task.id || !task.page || !task.product || !task.action) fail("maintenance queue contains an incomplete task");
  if (!["high", "medium", "low"].includes(task.priority)) fail(`unexpected task priority: ${task.priority}`);
}

if (!process.exitCode) {
  console.log(`Product intelligence audit passed: ${products.length} placements, ${tasks.length} queue tasks, ${summary.highPriorityTasks} high-priority tasks.`);
}
