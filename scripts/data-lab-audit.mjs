import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const errors = [];
const warnings = [];
const readJson = (path) => JSON.parse(readFileSync(join(root, path), "utf8").replace(/^\uFEFF/, ""));
const required = (condition, message) => { if (!condition) errors.push(message); };
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || "");
const validWebUrl = (value) => {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
};

const hub = readJson("data/data-lab.json");
const gps = readJson("data/gps-battery-planner.json");
const trail = readJson("data/trail-shoe-matrix.json");
const pageConfigs = [hub, gps, trail];
const slugs = pageConfigs.map((page) => page.slug);

required(new Set(slugs).size === slugs.length, "Data Lab page slugs must be unique.");
for (const page of pageConfigs) {
  const htmlPath = join(root, `${page.slug}.html`);
  required(existsSync(htmlPath), `${page.slug}: generated HTML is missing.`);
  if (!existsSync(htmlPath)) continue;
  const html = readFileSync(htmlPath, "utf8");
  required(html.includes(`https://www.phavai.com/${page.slug}.html`), `${page.slug}: canonical URL is missing.`);
  required(html.includes('class="review-byline"'), `${page.slug}: visible human-review byline is missing.`);
  required(html.includes('href="/data-lab.html"') || page.slug === "data-lab", `${page.slug}: Data Lab return link is missing.`);
  required(html.includes('type="application/ld+json"'), `${page.slug}: structured data is missing.`);
  required(!/data-affiliate-link/.test(html), `${page.slug}: retailer affiliate links must stay outside Data Lab tools.`);
}

required(Array.isArray(hub.resources) && hub.resources.length === 3, "Data Lab hub must list all three public resources.");
for (const resource of hub.resources || []) {
  required(resource.url?.startsWith("/") && existsSync(join(root, resource.url.slice(1))), `Hub resource does not resolve: ${resource.url}`);
}

required(Array.isArray(gps.modes) && gps.modes.length >= 8, "GPS planner needs a useful set of separate watch modes.");
const modeIds = gps.modes.map((mode) => mode.id);
required(new Set(modeIds).size === modeIds.length, "GPS mode IDs must be unique.");
required(modeIds.includes(gps.defaults?.modeId), "GPS default mode must resolve to a configured mode.");
for (const mode of gps.modes || []) {
  required(Number.isFinite(mode.officialHours) && mode.officialHours > 0, `${mode.id}: officialHours must be positive.`);
  required(validDate(mode.checkedDate), `${mode.id}: checkedDate must be ISO YYYY-MM-DD.`);
  required(validWebUrl(mode.sourceUrl), `${mode.id}: sourceUrl must be HTTPS.`);
  required(mode.claimType === "Manufacturer maximum", `${mode.id}: claim type must remain explicit.`);
}
required(readFileSync(join(root, "gps-battery-planner.html"), "utf8").includes("Manufacturer figures are maxima, not guarantees"), "GPS planner must expose its manufacturer-claim limitation.");
required(readFileSync(join(root, "gps-battery-planner.html"), "utf8").includes('src="/data-lab.js"'), "GPS planner must load the shared interactive script.");

const allowedTerrainLabels = new Set(["Primary match", "Capable", "Limited", "Insufficient evidence"]);
const productIds = trail.products.map((product) => product.id);
const productNames = trail.products.map((product) => product.product);
required(new Set(productIds).size === productIds.length, "Trail matrix product IDs must be unique.");
required(new Set(productNames).size === productNames.length, "Trail matrix product names must be unique.");
for (const product of trail.products || []) {
  for (const terrain of trail.terrainColumns || []) {
    required(allowedTerrainLabels.has(product.terrains?.[terrain.id]), `${product.product}: invalid ${terrain.id} terrain label.`);
  }
  required(validDate(product.checkedDate), `${product.product}: checkedDate must be ISO YYYY-MM-DD.`);
  required(validWebUrl(product.sourceUrl), `${product.product}: primary source must be HTTPS.`);
  required(validWebUrl(product.secondarySourceUrl), `${product.product}: secondary source must be HTTPS.`);
  required(product.guideUrl?.startsWith("/") && existsSync(join(root, product.guideUrl.slice(1))), `${product.product}: related Phavai guide does not resolve.`);
}
required((trail.heldModels || []).length > 0, "Trail matrix must disclose held models instead of forcing weak ratings.");
required(readFileSync(join(root, "trail-shoe-matrix.html"), "utf8").includes("Phavai did not hands-on test these shoes"), "Trail matrix must expose its no-hands-on-testing disclosure.");
required(readFileSync(join(root, "trail-shoe-matrix.html"), "utf8").includes('src="/data-lab.js"'), "Trail matrix must load the shared interactive script.");

const gpsCsv = join(root, "downloads/ultramarathon-gps-watch-battery-specifications.csv");
const trailCsv = join(root, "downloads/trail-shoe-terrain-fit-matrix.csv");
required(existsSync(gpsCsv), "GPS source CSV is missing.");
required(existsSync(trailCsv), "Trail matrix CSV is missing.");
if (existsSync(gpsCsv)) required(readFileSync(gpsCsv, "utf8").trim().split(/\r?\n/).length === gps.modes.length + 1, "GPS CSV row count does not match configured modes.");
if (existsSync(trailCsv)) required(readFileSync(trailCsv, "utf8").trim().split(/\r?\n/).length === trail.products.length + 1, "Trail CSV row count does not match configured products.");

const allHtml = readdirSync(root).filter((file) => file.endsWith(".html")).map((file) => readFileSync(join(root, file), "utf8")).join("\n");
for (const slug of slugs) {
  required(allHtml.split(`href="/${slug}.html"`).length > 2, `${slug}: needs reciprocal inbound links beyond its own page.`);
}

const sharedScriptPath = join(root, "data-lab.js");
required(existsSync(sharedScriptPath), "Shared Data Lab script is missing.");
if (existsSync(sharedScriptPath) && statSync(sharedScriptPath).size > 20_000) warnings.push("data-lab.js exceeds the 20 KB guardrail.");

if (errors.length) {
  console.error(`Data Lab audit failed with ${errors.length} error${errors.length === 1 ? "" : "s"}.`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Data Lab audit passed: ${gps.modes.length} GPS modes, ${trail.products.length} trail shoes, 3 public resources${warnings.length ? `, ${warnings.length} warning` : ""}.`);
for (const warning of warnings) console.warn(`- ${warning}`);
