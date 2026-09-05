import { basename } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";

const stopWords = new Set([
  "a", "an", "and", "are", "best", "buying", "for", "guide", "how", "in", "of", "on", "or", "phavai", "product", "products", "review", "reviews", "the", "to", "vs", "with"
]);

const args = parseArgs(process.argv.slice(2));
if (!args.pages) {
  console.error("Usage: node scripts/import-search-console.mjs --pages <Pages.csv> [--queries <Queries.csv>] [--chart <Chart.csv>]");
  process.exit(1);
}

const trackingPath = "data/search-console-tracking.json";
const tracking = JSON.parse(readFileSync(trackingPath, "utf8").replace(/^\uFEFF/, ""));
const pageRows = readCsv(args.pages);
const queryRows = args.queries ? readCsv(args.queries) : [];
const chartRows = args.chart ? readCsv(args.chart) : [];

const pageMetrics = new Map(pageRows.map((row) => [canonicalUrl(row["Top pages"]), {
  clicks: toNumber(row.Clicks),
  impressions: toNumber(row.Impressions),
  ctr: toPercent(row.CTR),
  position: toNumber(row.Position)
}]));

const queries = queryRows
  .map((row) => ({
    query: String(row["Top queries"] ?? "").trim(),
    clicks: toNumber(row.Clicks),
    impressions: toNumber(row.Impressions),
    ctr: toPercent(row.CTR),
    position: toNumber(row.Position)
  }))
  .filter((row) => row.query)
  .sort((a, b) => b.impressions - a.impressions || a.position - b.position);

let matchedPages = 0;
for (const page of tracking.live_pages ?? []) {
  const metrics = pageMetrics.get(canonicalUrl(page.url));
  if (!metrics) {
    delete page.search_metrics;
    continue;
  }

  const topQueries = inferQueriesForPage(page, queries).slice(0, 8);
  page.search_metrics = {
    ...metrics,
    primary_query: topQueries[0]?.query || page.primary_query || "",
    top_queries: topQueries,
    query_mapping: topQueries.length ? "inferred_from_sitewide_query_similarity" : "no_matching_sitewide_query",
    source: basename(args.pages)
  };
  matchedPages += 1;
}

const chart = chartRows
  .map((row) => ({
    date: String(row.Date ?? "").trim(),
    clicks: toNumber(row.Clicks),
    impressions: toNumber(row.Impressions),
    position: toNumber(row.Position)
  }))
  .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date))
  .sort((a, b) => a.date.localeCompare(b.date));

const firstWindow = summarizeWindow(chart.slice(0, 28));
const latestWindow = summarizeWindow(chart.slice(-28));
tracking.search_console_import = {
  imported_at: new Date().toISOString(),
  files: {
    pages: basename(args.pages),
    ...(args.queries ? { queries: basename(args.queries) } : {}),
    ...(args.chart ? { chart: basename(args.chart) } : {})
  },
  exported_page_rows: pageRows.length,
  matched_live_pages: matchedPages,
  unmatched_exported_pages: pageRows.length - matchedPages,
  site_summary: summarizeWindow(chart),
  first_28_days: firstWindow,
  latest_28_days: latestWindow,
  impression_change_pct: percentChange(firstWindow.impressions, latestWindow.impressions),
  click_change_pct: percentChange(firstWindow.clicks, latestWindow.clicks),
  query_mapping_note: "Queries.csv is sitewide. Per-page top queries are inferred by normalized title and slug token overlap, not exported as a landing-page/query join."
};

writeFileSync(trackingPath, `${JSON.stringify(tracking, null, 2)}\n`, "utf8");
console.log(`Imported ${pageRows.length} page rows; matched ${matchedPages} live pages; mapped ${queries.length} sitewide queries.`);

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (!key.startsWith("--")) continue;
    parsed[key.slice(2)] = values[index + 1];
    index += 1;
  }
  return parsed;
}

function readCsv(path) {
  const text = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  const rows = parseCsv(text);
  const headers = rows.shift() ?? [];
  return rows
    .filter((row) => row.some((value) => value !== ""))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows;
}

function canonicalUrl(value) {
  try {
    const url = new URL(String(value));
    const path = url.pathname === "/index.html" ? "/" : url.pathname;
    return `https://www.phavai.com${path}`;
  } catch {
    return String(value).trim().replace(/\/$/, "");
  }
}

function toNumber(value) {
  const number = Number.parseFloat(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function toPercent(value) {
  return Number((toNumber(value) / 100).toFixed(6));
}

function tokens(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/https?:\/\/[^/]+/g, " ")
    .replace(/\.html\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token && !stopWords.has(token));
}

function inferQueriesForPage(page, candidates) {
  const pageTokens = new Set(tokens(`${page.title} ${page.path}`));
  return candidates
    .map((candidate) => {
      const queryTokens = new Set(tokens(candidate.query));
      const matches = [...queryTokens].filter((token) => pageTokens.has(token)).length;
      const requiredMatches = Math.min(pageTokens.size, queryTokens.size) <= 1 ? 1 : 2;
      const score = matches
        ? (matches / Math.max(1, queryTokens.size)) * 0.62 + (matches / Math.max(1, pageTokens.size)) * 0.38
        : 0;
      return { ...candidate, match_score: Number(score.toFixed(3)), matches };
    })
    .filter((candidate) => candidate.matches >= (Math.min(pageTokens.size, tokens(candidate.query).length) <= 1 ? 1 : 2) && candidate.match_score >= 0.58)
    .sort((a, b) => b.impressions - a.impressions || b.match_score - a.match_score)
    .map(({ matches, ...candidate }) => candidate);
}

function summarizeWindow(rows) {
  const clicks = rows.reduce((total, row) => total + row.clicks, 0);
  const impressions = rows.reduce((total, row) => total + row.impressions, 0);
  const weightedPosition = rows.reduce((total, row) => total + row.position * row.impressions, 0);
  return {
    start: rows[0]?.date ?? null,
    end: rows.at(-1)?.date ?? null,
    days: rows.length,
    clicks,
    impressions,
    ctr: impressions ? Number((clicks / impressions).toFixed(6)) : 0,
    position: impressions ? Number((weightedPosition / impressions).toFixed(2)) : null
  };
}

function percentChange(previous, current) {
  if (!previous) return current ? null : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}
