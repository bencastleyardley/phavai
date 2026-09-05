import { readFileSync, writeFileSync } from "node:fs";

const OUTPUT_PATH = "data/performance-snapshot.json";

function argsFor(flag) {
  const values = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === flag && process.argv[index + 1]) values.push(process.argv[index + 1]);
  }
  return values;
}

function firstArg(flag) {
  return argsFor(flag)[0] || "";
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
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

function csvObjects(path) {
  const rows = parseCsv(readFileSync(path, "utf8").replace(/^\uFEFF/, ""))
    .filter((row) => !String(row[0] || "").startsWith("#"));
  const headers = rows.shift()?.map((header) => header.trim()) || [];
  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

function number(value) {
  const parsed = Number(String(value ?? "").replace(/[$,%]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function gaSnapshot(path) {
  const events = csvObjects(path);
  const byName = new Map(events.map((row) => [row["Event name"], row]));
  const event = (name, field = "Event count") => number(byName.get(name)?.[field]);
  const pageViews = event("page_view");
  const outboundRetailerClicks = event("outbound_retailer_click") || event("buy_now_click") || event("product_cta_click");
  return {
    status: "imported",
    source: path.split(/[\\/]/).pop(),
    pageViews,
    sessions: event("session_start"),
    activeUsers: event("page_view", "Total users"),
    productCtaClicks: event("product_cta_click") || event("buy_now_click"),
    outboundRetailerClicks,
    clickUsers: event("outbound_retailer_click", "Total users") || event("buy_now_click", "Total users"),
    outboundClicksPerPageView: pageViews ? Number((outboundRetailerClicks / pageViews).toFixed(4)) : 0,
    productBreakdownAvailable: false,
    note: "Product-level reporting requires a GA4 export that includes the registered product_name, retailer, guide_title, and link_domain custom dimensions."
  };
}

function amazonSnapshot(paths) {
  if (!paths.length) {
    return {
      status: "needs_current_period_export",
      clicks: null,
      itemsOrdered: null,
      orderedRevenue: null,
      totalEarnings: null,
      note: "No Amazon report supplied for this reporting window."
    };
  }
  const rows = paths.flatMap(csvObjects);
  return {
    status: "imported",
    sources: paths.map((path) => path.split(/[\\/]/).pop()),
    clicks: rows.reduce((total, row) => total + number(row.Clicks), 0),
    itemsOrdered: rows.reduce((total, row) => total + number(row["Items Ordered"]), 0),
    orderedRevenue: Number(rows.reduce((total, row) => total + number(row["Ordered Revenue"]), 0).toFixed(2)),
    totalEarnings: Number(rows.reduce((total, row) => total + number(row["Total Earnings"]), 0).toFixed(2)),
    note: paths.length > 1 ? "Combined reports. Confirm they cover distinct tracking IDs within the same date range." : "One Tracking ID report imported."
  };
}

const gaPath = firstArg("--ga-events");
if (!gaPath) {
  console.error("Usage: npm run performance:import -- --ga-events <GA4 Events CSV> [--amazon-tracking <Amazon CSV>] --start YYYY-MM-DD --end YYYY-MM-DD");
  process.exit(1);
}

const start = firstArg("--start");
const end = firstArg("--end");
if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
  console.error("Provide --start and --end in YYYY-MM-DD format so GA4 and Amazon periods can be matched.");
  process.exit(1);
}

const snapshot = {
  updatedAt: new Date().toISOString(),
  period: { start, end, label: firstArg("--period-label") || `${start} to ${end}` },
  ga4: gaSnapshot(gaPath),
  amazon: amazonSnapshot(argsFor("--amazon-tracking"))
};

writeFileSync(OUTPUT_PATH, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
console.log(`Wrote ${OUTPUT_PATH} for ${snapshot.period.label}.`);
