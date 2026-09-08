import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync("data/indexnow.json", "utf8"));
const args = process.argv.slice(2);

function sitemapUrls() {
  const sitemap = readFileSync("sitemap.xml", "utf8");
  return [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

function normalizeUrl(value) {
  if (/^https:\/\//i.test(value)) return value;
  return `https://${config.host}/${value.replace(/^\/+/, "")}`;
}

const urls = (args.includes("--sitemap") ? sitemapUrls() : args.filter((arg) => !arg.startsWith("--")).map(normalizeUrl))
  .filter((url, index, list) => list.indexOf(url) === index);

if (!urls.length) {
  throw new Error("Provide one or more changed URLs, or use --sitemap after a broad site update.");
}

const keyResponse = await fetch(config.keyLocation, { redirect: "follow" });
const keyBody = (await keyResponse.text()).trim();
if (!keyResponse.ok || keyBody !== config.key) {
  throw new Error(`IndexNow key verification failed at ${config.keyLocation} (${keyResponse.status}). Deploy the key file first.`);
}

const response = await fetch(config.endpoint, {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: config.host,
    key: config.key,
    keyLocation: config.keyLocation,
    urlList: urls
  })
});

if (![200, 202].includes(response.status)) {
  throw new Error(`IndexNow submission failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
}

console.log(`IndexNow accepted ${urls.length} changed URL${urls.length === 1 ? "" : "s"} (${response.status}).`);
