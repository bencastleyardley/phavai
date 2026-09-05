import { existsSync, readFileSync } from "node:fs";

const cachePath = process.env.PHAVAI_AMAZON_CACHE_PATH || ".cache/amazon-creators.json";
if (!existsSync(cachePath)) {
  console.log("Amazon catalog audit skipped: no local cache. Brand-neutral fallback visuals remain active.");
  process.exit(0);
}

const raw = readFileSync(cachePath, "utf8");
const cache = JSON.parse(raw);
const errors = [];
const forbiddenKeys = /credential|secret|access.?token|client.?id/i;

function inspectKeys(value, path = "cache") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeys.test(key)) errors.push(`${path}.${key}: credential material must never be cached`);
    inspectKeys(child, `${path}.${key}`);
  }
}

inspectKeys(cache);
if (cache.schemaVersion !== 1) errors.push("cache.schemaVersion must be 1");
if (!Array.isArray(cache.items) || !cache.items.length) errors.push("cache.items must contain at least one product");
if (new Date(cache.expiresAt).getTime() <= Date.now()) errors.push("Amazon catalog cache is expired");

const seen = new Set();
for (const item of cache.items || []) {
  if (!/^[A-Z0-9]{10}$/.test(item.asin || "")) errors.push(`invalid ASIN: ${item.asin || "missing"}`);
  if (seen.has(item.asin)) errors.push(`duplicate ASIN: ${item.asin}`);
  seen.add(item.asin);
  if (item.detailPageURL && !/^https:\/\/([^/]+\.)?amazon\.com\//i.test(item.detailPageURL)) errors.push(`${item.asin}: unexpected product URL domain`);
  if (item.image?.url && !/^https:\/\/[^/]*media-amazon\.com\//i.test(item.image.url)) errors.push(`${item.asin}: unexpected image URL domain`);
}

if (errors.length) {
  console.error(`Amazon catalog audit failed with ${errors.length} error(s).`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Amazon catalog audit passed for ${cache.items.length} cached item(s); expires ${cache.expiresAt}.`);
