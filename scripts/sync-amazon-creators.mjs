import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const MARKETPLACE = process.env.PHAVAI_AMAZON_MARKETPLACE || "www.amazon.com";
const PARTNER_TAG = process.env.PHAVAI_AMAZON_PARTNER_TAG || process.env.AMAZON_ASSOCIATE_TAG || "phavai7311-20";
const CACHE_PATH = process.env.PHAVAI_AMAZON_CACHE_PATH || ".cache/amazon-creators.json";
const API_BASE = "https://creatorsapi.amazon";
const RESOURCES = ["images.primary.medium", "images.primary.large", "itemInfo.title", "itemInfo.byLineInfo", "parentASIN"];
const TOKEN_ENDPOINTS = {
  "3.1": "https://api.amazon.com/auth/o2/token",
  "3.2": "https://api.amazon.co.uk/auth/o2/token",
  "3.3": "https://api.amazon.co.jp/auth/o2/token"
};

function parseArgs(argv) {
  const args = { smoke: false, credentialsCsv: "" };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--smoke") args.smoke = true;
    if (argv[index] === "--credentials-csv") args.credentialsCsv = argv[index + 1] || "";
  }
  return args;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.length)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((value) => value.length)) rows.push(row);
  if (rows.length < 2) throw new Error("Credential CSV must include a header and at least one credential row.");
  const headers = rows[0].map((value) => value.replace(/^\uFEFF/, "").trim());
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() || ""])));
}

function loadCredentials(credentialsCsv) {
  const fromEnvironment = {
    credentialId: process.env.PHAVAI_AMAZON_CREDENTIAL_ID || "",
    credentialSecret: process.env.PHAVAI_AMAZON_CREDENTIAL_SECRET || "",
    version: process.env.PHAVAI_AMAZON_CREDENTIAL_VERSION || "3.1"
  };
  if (fromEnvironment.credentialId && fromEnvironment.credentialSecret) return fromEnvironment;
  if (!credentialsCsv) {
    throw new Error("Set PHAVAI_AMAZON_CREDENTIAL_ID and PHAVAI_AMAZON_CREDENTIAL_SECRET, or pass --credentials-csv <path>.");
  }
  const row = parseCsv(readFileSync(credentialsCsv, "utf8"))[0];
  return {
    credentialId: row["Credential Id"] || row["Credential ID"] || "",
    credentialSecret: row.Secret || row["Credential Secret"] || "",
    version: row.Version || "3.1"
  };
}

function asinFromUrl(value = "") {
  try {
    const url = new URL(value);
    if (!/(^|\.)amazon\.com$/i.test(url.hostname)) return "";
    return url.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:\/|$)/i)?.[1]?.toUpperCase() || "";
  } catch {
    return "";
  }
}

function catalogTargets() {
  const overrides = JSON.parse(readFileSync("data/affiliate-overrides.json", "utf8").replace(/^\uFEFF/, ""));
  const targets = new Map();
  for (const item of overrides) {
    const asin = String(item.asin || asinFromUrl(item.url)).toUpperCase();
    if (!/^[A-Z0-9]{10}$/.test(asin)) continue;
    if (!targets.has(asin)) targets.set(asin, { asin, productName: item.productName || "", categorySlug: item.categorySlug || "" });
  }
  return [...targets.values()];
}

async function fetchJson(url, options, label) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${label} returned non-JSON HTTP ${response.status}.`);
  }
  if (!response.ok) {
    const reason = body.error_description || body.message || body.errors?.[0]?.message || response.statusText;
    throw new Error(`${label} failed with HTTP ${response.status}: ${reason}`);
  }
  return body;
}

async function accessToken(credentials) {
  const endpoint = TOKEN_ENDPOINTS[credentials.version];
  if (!endpoint) throw new Error(`Unsupported credential version ${credentials.version}. Expected 3.1, 3.2, or 3.3.`);
  const body = await fetchJson(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: credentials.credentialId,
      client_secret: credentials.credentialSecret,
      scope: "creatorsapi::default"
    })
  }, "Amazon access-token request");
  if (!body.access_token) throw new Error("Amazon token response did not include an access token.");
  return body.access_token;
}

async function getItems(token, itemIds) {
  return fetchJson(`${API_BASE}/catalog/v1/getItems`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "x-marketplace": MARKETPLACE
    },
    body: JSON.stringify({
      itemIds,
      itemIdType: "ASIN",
      marketplace: MARKETPLACE,
      partnerTag: PARTNER_TAG,
      resources: RESOURCES
    })
  }, "Amazon GetItems request");
}

function normalizedItem(item) {
  const medium = item.images?.primary?.medium;
  const large = item.images?.primary?.large;
  const image = large?.url ? large : medium?.url ? medium : null;
  return {
    asin: item.asin,
    detailPageURL: item.detailPageURL || "",
    title: item.itemInfo?.title?.displayValue || "",
    brand: item.itemInfo?.byLineInfo?.brand?.displayValue || "",
    parentASIN: item.parentASIN || "",
    image: image ? { url: image.url, width: image.width || null, height: image.height || null } : null
  };
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const args = parseArgs(process.argv.slice(2));
const credentials = loadCredentials(args.credentialsCsv);
if (!credentials.credentialId || !credentials.credentialSecret) throw new Error("The selected credential row is missing Credential Id or Secret.");
const targets = catalogTargets();
if (!targets.length) throw new Error("No exact Amazon ASINs were found in data/affiliate-overrides.json.");

console.log(`Amazon Creators API: authenticating credential version ${credentials.version}; no secret will be logged.`);
const token = await accessToken(credentials);
const batches = args.smoke ? [[targets[0].asin]] : Array.from({ length: Math.ceil(targets.length / 10) }, (_, index) => targets.slice(index * 10, index * 10 + 10).map((item) => item.asin));
const items = [];
const errors = [];

for (let index = 0; index < batches.length; index += 1) {
  const result = await getItems(token, batches[index]);
  items.push(...(result.itemsResult?.items || result.items || []).map(normalizedItem));
  errors.push(...(result.errors || []));
  console.log(`Amazon Creators API: batch ${index + 1}/${batches.length} returned ${(result.itemsResult?.items || result.items || []).length} item(s).`);
  if (index < batches.length - 1) await delay(1100);
}

if (args.smoke) {
  if (!items.length) throw new Error(`Amazon GetItems smoke test returned no item. ${errors[0]?.message || ""}`.trim());
  console.log(`Amazon Creators API smoke test passed for ASIN ${items[0].asin}.`);
  process.exit(0);
}

const generatedAt = new Date();
const cache = {
  schemaVersion: 1,
  generatedAt: generatedAt.toISOString(),
  expiresAt: new Date(generatedAt.getTime() + 23 * 60 * 60 * 1000).toISOString(),
  marketplace: MARKETPLACE,
  partnerTag: PARTNER_TAG,
  requested: targets.length,
  returned: items.length,
  items,
  errors: errors.map((error) => ({ code: error.code || "Unknown", message: error.message || "Unknown Amazon API error" }))
};
mkdirSync(dirname(CACHE_PATH), { recursive: true });
writeFileSync(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
console.log(`Amazon Creators API: wrote ${items.length}/${targets.length} items to ${CACHE_PATH}; cache expires in 23 hours.`);
