import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const site = "https://www.phavai.com";
const root = process.cwd();
const htmlFiles = readdirSync(root).filter((file) => file.endsWith(".html")).sort();
const report = {
  generated_at: new Date().toISOString(),
  pages_checked: htmlFiles.length,
  public_pages: 0,
  private_pages: 0,
  errors: [],
  warnings: [],
  pages: []
};

function addError(message) {
  report.errors.push(message);
}

function addWarning(message) {
  report.warnings.push(message);
}

function matchOne(html, regex) {
  return html.match(regex)?.[1]?.trim() ?? "";
}

function canonicalFor(file) {
  return file === "index.html" ? `${site}/` : `${site}/${file}`;
}

function localPathFromHref(href) {
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return "";
  if (/^https?:\/\//i.test(href)) {
    try {
      const url = new URL(href);
      if (url.hostname !== "www.phavai.com" && url.hostname !== "phavai.com") return "";
      href = url.pathname;
    } catch {
      return "";
    }
  }
  if (!href.startsWith("/")) return href.split("#")[0].split("?")[0];
  const cleaned = href.split("#")[0].split("?")[0];
  if (cleaned === "/" || cleaned === "/index.html") return "index.html";
  return cleaned.replace(/^\//, "");
}

function parseJsonLd(html, file) {
  const rowsFound = [];
  const blocks = html.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) ?? [];
  for (const block of blocks) {
    const json = block.replace(/^<script type="application\/ld\+json">/i, "").replace(/<\/script>$/i, "").trim();
    try {
      const parsed = JSON.parse(json);
      const rows = Array.isArray(parsed) ? parsed : [parsed];
      rowsFound.push(...rows);
    } catch {
      addWarning(`${file}: invalid JSON-LD block`);
    }
  }
  return rowsFound;
}

const sitemapPath = join(root, "sitemap.xml");
const robotsPath = join(root, "robots.txt");

if (!existsSync(sitemapPath)) addError("Missing sitemap.xml");
if (!existsSync(robotsPath)) addError("Missing robots.txt");

const sitemap = existsSync(sitemapPath) ? readFileSync(sitemapPath, "utf8") : "";
const robots = existsSync(robotsPath) ? readFileSync(robotsPath, "utf8") : "";
const sitemapLocs = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
const inboundLinks = new Map(htmlFiles.map((file) => [file, 0]));
const publicFiles = new Set();

if (!robots.includes("User-agent: *")) addError("robots.txt is missing User-agent: *");
if (!robots.includes("Allow: /")) addError("robots.txt is missing Allow: /");
if (!robots.includes(`Sitemap: ${site}/sitemap.xml`)) addError("robots.txt does not reference the production sitemap.");

for (const file of htmlFiles) {
  const html = readFileSync(join(root, file), "utf8");
  const title = matchOne(html, /<title>([\s\S]*?)<\/title>/i);
  const description = matchOne(html, /<meta name="description" content="([^"]*)"/i);
  const canonical = matchOne(html, /<link rel="canonical" href="([^"]*)"/i);
  const h1 = matchOne(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i).replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
  const jsonLd = parseJsonLd(html, file);
  const types = jsonLd.map((row) => row["@type"]).filter(Boolean);
  const expectedCanonical = canonicalFor(file);
  const sitemapUrl = expectedCanonical;
  const isNoindex = /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html);

  if (!title) addError(`${file}: missing title`);
  if (!description) addError(`${file}: missing meta description`);
  if (!canonical) addError(`${file}: missing canonical`);
  if (canonical && canonical !== expectedCanonical) addError(`${file}: canonical ${canonical} does not match ${expectedCanonical}`);
  if (!h1) addError(`${file}: missing H1`);
  if (isNoindex) {
    report.private_pages += 1;
    if (sitemapLocs.includes(sitemapUrl)) addError(`${file}: noindex page should not be listed in sitemap`);
  } else {
    publicFiles.add(file);
    report.public_pages += 1;
    if (/noindex/i.test(html)) addError(`${file}: contains noindex`);
    if (!sitemapLocs.includes(sitemapUrl)) addError(`${file}: canonical URL missing from sitemap`);
    if (file !== "index.html" && !types.includes("BreadcrumbList")) addError(`${file}: missing BreadcrumbList JSON-LD`);
  }

  if (!isNoindex && file.startsWith("best-")) {
    if (!types.includes("Article")) addError(`${file}: review page missing Article JSON-LD`);
    if (!types.includes("ItemList")) addError(`${file}: review page missing ItemList JSON-LD`);
  }

  if (!isNoindex && types.includes("FAQPage")) addWarning(`${file}: FAQPage JSON-LD is no longer useful for Google rich results`);

  const article = jsonLd.find((row) => row["@type"] === "Article");
  if (!isNoindex && article) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(article.datePublished || "")) addError(`${file}: Article datePublished must be an ISO date`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(article.dateModified || "")) addError(`${file}: Article dateModified must be an ISO date`);
    if (!article.author?.name || !article.author?.url) addError(`${file}: Article author must include a visible identity and URL`);
    if (!/class="review-byline"/.test(html)) addError(`${file}: Article is missing its visible research byline`);
  }

  if (!isNoindex && description.length > 160) addWarning(`${file}: meta description is ${description.length} characters`);
  if (/href="\/index\.html"/.test(html)) addError(`${file}: internal Home links must use the canonical / URL`);

  if (!isNoindex && /^how-|^.*-vs-/.test(file) && !types.includes("Article")) {
    addError(`${file}: supporting guide missing Article JSON-LD`);
  }

  for (const hrefMatch of html.matchAll(/href="([^"]+)"/g)) {
    const target = localPathFromHref(hrefMatch[1]);
    if (!target) continue;
    if (!existsSync(join(root, target))) addError(`${file}: broken internal link to ${hrefMatch[1]}`);
    if (target !== file && inboundLinks.has(target)) inboundLinks.set(target, inboundLinks.get(target) + 1);
  }

  report.pages.push({
    file,
    title,
    description_length: description.length,
    canonical,
    h1,
    structured_data_types: types
  });
}

for (const file of publicFiles) {
  if (file !== "index.html" && inboundLinks.get(file) === 0) addError(`${file}: orphaned public page has no internal links pointing to it`);
}

const expectedSitemapCount = report.public_pages;
if (sitemapLocs.length !== expectedSitemapCount) {
  addError(`sitemap.xml has ${sitemapLocs.length} URLs; expected ${expectedSitemapCount}.`);
}

writeFileSync("data/seo-audit-report.json", `${JSON.stringify(report, null, 2)}\n`, "utf8");

if (report.errors.length) {
  console.error(`SEO audit failed with ${report.errors.length} errors and ${report.warnings.length} warnings.`);
  for (const error of report.errors.slice(0, 20)) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`SEO audit passed for ${report.pages_checked} pages with ${report.warnings.length} warnings.`);
