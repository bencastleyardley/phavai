import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const generatedDir = "photos/generated";
const categoriesPath = "data/categories.json";
const sectionsPath = "data/sections.json";
const supportingPath = "data/supporting.json";
const imageSourcesPath = "data/image-sources.json";

mkdirSync(generatedDir, { recursive: true });

const categories = JSON.parse(readFileSync(categoriesPath, "utf8").replace(/^\uFEFF/, ""));
const sections = JSON.parse(readFileSync(sectionsPath, "utf8").replace(/^\uFEFF/, ""));
const supportingPages = JSON.parse(readFileSync(supportingPath, "utf8").replace(/^\uFEFF/, ""));

const sourceEntries = {};
const usedPaths = new Set();

const palettes = [
  ["#0f172a", "#22c55e", "#ecfeff", "#f59e0b"],
  ["#111827", "#38bdf8", "#f8fafc", "#fb7185"],
  ["#1f2937", "#a3e635", "#f9fafb", "#14b8a6"],
  ["#18181b", "#f97316", "#fff7ed", "#2563eb"],
  ["#172554", "#facc15", "#eff6ff", "#10b981"],
  ["#312e81", "#fb7185", "#f5f3ff", "#22c55e"],
  ["#064e3b", "#60a5fa", "#ecfdf5", "#f97316"],
  ["#3f3f46", "#2dd4bf", "#fafafa", "#a855f7"]
];

const iconRules = [
  [/watch|gps|forerunner|garmin|coros|suunto|polar/i, "watch"],
  [/headphone|earbud|shokz|bose|jabra|sony/i, "headphones"],
  [/desk|work/i, "desk"],
  [/chair|aeron|gesture|embody|branch/i, "chair"],
  [/webcam|camera|brio|insta360|obsbot|anker/i, "webcam"],
  [/keyboard|keychron|logitech|microsoft|kinesis/i, "keyboard"],
  [/monitor arm|ergotron|jarvis|human/i, "monitor"],
  [/desk mat|mat/i, "mat"],
  [/luggage|carry|roller|spinner|suitcase/i, "luggage"],
  [/coffee|brewer|moccamaster|oxo|bonavita|aiden/i, "coffee"],
  [/massage|theragun|hypervolt|renpho|bob and brad/i, "massage"],
  [/air purifier|coway|levoit|blueair|winix|mila/i, "purifier"],
  [/hydration|vest|pack|salomon adv skin|nathan|camelbak|ultraspire|black diamond/i, "vest"],
  [/pole|poles|distance carbon|leki/i, "poles"],
  [/sandal|slide|recovery|ora|oofos|teva|crocs/i, "sandal"],
  [/shoe|trainer|trail|marathon|runner|hoka|brooks|saucony|altra|topo|nike|asics|new balance|speedgoat|peregrine|catamount|cascadia|novablast|bondi|clifton|ghost|glycerin|pegasus|ride|lone peak|speedcross|x-talon/i, "shoe"]
];

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function hash(value) {
  let total = 0;
  for (let index = 0; index < value.length; index += 1) {
    total = (total * 31 + value.charCodeAt(index)) >>> 0;
  }
  return total;
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&apos;"
  })[char]);
}

function wrapText(value, maxLength = 22, maxLines = 3) {
  const words = String(value).split(/\s+/);
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);

  if (lines.length > maxLines) {
    const clipped = lines.slice(0, maxLines);
    clipped[maxLines - 1] = `${clipped[maxLines - 1].replace(/\.*$/, "")}...`;
    return clipped;
  }

  return lines;
}

function iconFor(label) {
  return iconRules.find(([pattern]) => pattern.test(label))?.[1] ?? "product";
}

function iconSvg(type, color, accent) {
  const stroke = `stroke="${color}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  if (type === "home") {
    return `<rect x="230" y="230" width="310" height="390" rx="44" fill="#fff" opacity=".88"/><rect x="285" y="185" width="310" height="390" rx="44" fill="${color}"/><rect x="335" y="255" width="190" height="28" rx="14" fill="#fff" opacity=".82"/><rect x="335" y="320" width="150" height="24" rx="12" fill="#fff" opacity=".58"/><rect x="335" y="374" width="178" height="24" rx="12" fill="#fff" opacity=".58"/><path d="M352 500l58 58 145-164" stroke="${accent}" stroke-width="34" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="610" cy="570" r="96" fill="#fff" opacity=".9"/><circle cx="610" cy="570" r="58" ${stroke}/><path d="M655 615l78 78" ${stroke}/>`;
  }
  if (type === "watch") {
    return `<rect x="365" y="175" width="170" height="90" rx="38" fill="${accent}" opacity=".72"/><circle cx="450" cy="450" r="118" fill="#fff" opacity=".9"/><circle cx="450" cy="450" r="80" ${stroke}/><path d="M450 405v50l42 28" ${stroke}/><rect x="365" y="635" width="170" height="90" rx="38" fill="${accent}" opacity=".72"/>`;
  }
  if (type === "headphones") {
    return `<path d="M280 500v-92c0-120 76-202 170-202s170 82 170 202v92" ${stroke}/><rect x="215" y="470" width="108" height="180" rx="42" fill="${color}"/><rect x="577" y="470" width="108" height="180" rx="42" fill="${color}"/><path d="M345 660c70 42 140 42 210 0" ${stroke}/>`;
  }
  if (type === "desk") {
    return `<rect x="185" y="350" width="530" height="64" rx="22" fill="${color}"/><path d="M270 414v220M630 414v220" ${stroke}/><rect x="350" y="220" width="200" height="118" rx="18" fill="#fff" opacity=".9"/><path d="M395 338h110" ${stroke}/>`;
  }
  if (type === "chair") {
    return `<rect x="315" y="225" width="270" height="260" rx="72" fill="${color}"/><rect x="295" y="470" width="310" height="98" rx="42" fill="${accent}"/><path d="M450 568v92M360 695h180M325 750h250" ${stroke}/>`;
  }
  if (type === "webcam") {
    return `<rect x="245" y="285" width="410" height="260" rx="78" fill="${color}"/><circle cx="450" cy="415" r="92" fill="#fff" opacity=".9"/><circle cx="450" cy="415" r="48" fill="${accent}"/><path d="M375 555h150l40 120H335l40-120Z" fill="${color}" opacity=".85"/>`;
  }
  if (type === "keyboard") {
    return `<rect x="165" y="320" width="570" height="260" rx="42" fill="${color}"/><g fill="#fff" opacity=".9">${Array.from({ length: 18 }, (_, index) => `<rect x="${210 + (index % 6) * 80}" y="${365 + Math.floor(index / 6) * 58}" width="48" height="32" rx="8"/>`).join("")}</g><rect x="290" y="548" width="320" height="34" rx="12" fill="${accent}"/>`;
  }
  if (type === "monitor") {
    return `<rect x="185" y="215" width="360" height="230" rx="28" fill="${color}"/><path d="M545 330h115v260M545 585h180" ${stroke}/><rect x="245" y="480" width="240" height="46" rx="18" fill="${accent}"/><rect x="300" y="525" width="130" height="86" rx="16" fill="${color}"/>`;
  }
  if (type === "mat") {
    return `<rect x="175" y="300" width="550" height="320" rx="64" fill="${color}"/><rect x="245" y="365" width="210" height="135" rx="24" fill="#fff" opacity=".88"/><circle cx="580" cy="430" r="78" fill="${accent}"/><path d="M270 565h360" ${stroke}/>`;
  }
  if (type === "luggage") {
    return `<rect x="300" y="230" width="300" height="430" rx="52" fill="${color}"/><path d="M385 225v-45h130v45M380 310v260M450 310v260M520 310v260" ${stroke}/><circle cx="370" cy="705" r="30" fill="${accent}"/><circle cx="530" cy="705" r="30" fill="${accent}"/>`;
  }
  if (type === "coffee") {
    return `<rect x="285" y="285" width="285" height="330" rx="48" fill="${color}"/><path d="M570 385h40c58 0 58 112 0 112h-40M340 220c-28-42 28-60 0-102M435 220c-28-42 28-60 0-102M515 220c-28-42 28-60 0-102" ${stroke}/><rect x="315" y="620" width="230" height="48" rx="20" fill="${accent}"/>`;
  }
  if (type === "massage") {
    return `<circle cx="310" cy="315" r="98" fill="${accent}"/><rect x="380" y="345" width="300" height="125" rx="60" fill="${color}" transform="rotate(25 380 345)"/><rect x="470" y="445" width="112" height="245" rx="46" fill="${color}" transform="rotate(25 470 445)"/><path d="M225 520c60-35 120-35 180 0" ${stroke}/>`;
  }
  if (type === "purifier") {
    return `<rect x="310" y="205" width="280" height="480" rx="62" fill="${color}"/><g fill="#fff" opacity=".9">${Array.from({ length: 18 }, (_, index) => `<circle cx="${365 + (index % 3) * 70}" cy="${310 + Math.floor(index / 3) * 48}" r="11"/>`).join("")}</g><path d="M235 330c-65-42-65-112 10-140M665 570c65 42 65 112-10 140" ${stroke}/>`;
  }
  if (type === "vest") {
    return `<path d="M315 205h110l25 125 25-125h110l78 480H510l-60-178-60 178H237l78-480Z" fill="${color}"/><rect x="300" y="385" width="95" height="155" rx="30" fill="#fff" opacity=".86"/><rect x="505" y="385" width="95" height="155" rx="30" fill="${accent}" opacity=".9"/>`;
  }
  if (type === "poles") {
    return `<path d="M325 165l-80 570M575 165l80 570" ${stroke}/><path d="M280 280h90M530 280h90M230 735h120M550 735h120" ${stroke}/><circle cx="325" cy="165" r="38" fill="${accent}"/><circle cx="575" cy="165" r="38" fill="${accent}"/>`;
  }
  if (type === "sandal") {
    return `<path d="M245 525c70-110 165-162 285-155 85 5 145 55 130 122-22 98-140 170-292 180-88 6-150-12-123-147Z" fill="${color}"/><path d="M370 405c35 75 78 125 160 175M420 395c-12 85-55 135-140 150" ${stroke}/><circle cx="535" cy="470" r="30" fill="${accent}"/>`;
  }
  if (type === "shoe") {
    return `<path d="M205 525c70-100 120-155 205-175 70 90 157 138 280 154 44 6 66 44 45 82-28 50-134 75-280 70-116-4-215-28-250-66-18-20-19-43 0-65Z" fill="${color}"/><path d="M300 520h310M385 425l-58 78M460 448l-55 72M535 475l-45 60" ${stroke}/><path d="M235 605c115 30 310 42 470 10" stroke="${accent}" stroke-width="24" stroke-linecap="round" fill="none"/>`;
  }
  return `<rect x="250" y="250" width="400" height="400" rx="88" fill="${color}"/><circle cx="450" cy="450" r="112" fill="#fff" opacity=".86"/><path d="M365 455h170M450 370v170" ${stroke}/>`;
}

function sourceFor(path, label, kind) {
  sourceEntries[path] = {
    sourceName: "Phavai generated visual library",
    sourceUrl: `https://www.phavai.com${path}`,
    credit: "Phavai",
    license: "Original Phavai-owned editorial illustration",
    licenseUrl: "",
    requiresAttribution: false,
    exactProduct: false,
    usage: `${kind} visual generated for ${label}. Brand-neutral illustration; not a manufacturer product photo.`
  };
}

function uniquePath(prefix, label) {
  const base = `${prefix}-${slugify(label)}`.replace(/-+/g, "-");
  let path = `/photos/generated/${base}.svg`;
  let suffix = 2;
  while (usedPaths.has(path)) {
    path = `/photos/generated/${base}-${suffix}.svg`;
    suffix += 1;
  }
  usedPaths.add(path);
  return path;
}

function writeVisual(path, label, context, kind, iconType = iconFor(`${label} ${context}`)) {
  const seed = hash(`${path}:${label}:${context}`);
  const [ink, accent, paper, highlight] = palettes[seed % palettes.length];
  const secondary = palettes[(seed + 3) % palettes.length][1];
  const scale = 0.92 + (seed % 7) * 0.012;
  const rotate = (seed % 13) - 6;
  const leftDot = 130 + (seed % 210);
  const rightDot = 690 - (seed % 170);
  const lowerDot = 620 + (seed % 90);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900" viewBox="0 0 900 900" role="img" aria-label="${escapeXml(`${label} ${kind} visual`)}">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="${paper}"/>
      <stop offset=".62" stop-color="#ffffff"/>
      <stop offset="1" stop-color="${accent}" stop-opacity=".22"/>
    </linearGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M48 0H0v48" fill="none" stroke="${ink}" stroke-opacity=".06" stroke-width="2"/>
    </pattern>
  </defs>
  <rect width="900" height="900" rx="72" fill="url(#bg)"/>
  <rect width="900" height="900" rx="72" fill="url(#grid)"/>
  <circle cx="${170 + (seed % 120)}" cy="${155 + (seed % 80)}" r="115" fill="${highlight}" opacity=".18"/>
  <circle cx="${725 - (seed % 100)}" cy="${235 + (seed % 100)}" r="155" fill="${secondary}" opacity=".14"/>
  <path d="M${leftDot} 705c70-48 150-48 220 0" stroke="${accent}" stroke-width="24" stroke-linecap="round" opacity=".34" fill="none"/>
  <path d="M${rightDot} 150c44 40 92 40 136 0" stroke="${highlight}" stroke-width="20" stroke-linecap="round" opacity=".38" fill="none"/>
  <circle cx="${leftDot}" cy="${lowerDot}" r="${22 + (seed % 28)}" fill="${accent}" opacity=".22"/>
  <circle cx="${rightDot}" cy="${lowerDot - 70}" r="${18 + (seed % 24)}" fill="${secondary}" opacity=".25"/>
  <rect x="${120 + (seed % 80)}" y="${310 + (seed % 50)}" width="58" height="58" rx="18" fill="#fff" opacity=".48"/>
  <rect x="${690 - (seed % 90)}" y="${585 - (seed % 60)}" width="72" height="72" rx="24" fill="#fff" opacity=".36"/>
  <g transform="translate(0 14) rotate(${rotate} 450 450) scale(${scale}) translate(${(1 - scale) * 450} ${(1 - scale) * 450})">
    ${iconSvg(iconType, ink, accent)}
  </g>
</svg>
`;
  writeFileSync(`.${path}`, svg, "utf8");
  sourceFor(path, label, kind);
}

for (const section of sections) {
  const imagePath = uniquePath("section", section.slug);
  section.image = imagePath;
  writeVisual(imagePath, section.title, "Category hub", "section", iconFor(section.title));
}

for (const category of categories) {
  const guidePath = uniquePath("guide", category.slug);
  category.image = guidePath;
  writeVisual(guidePath, category.title, category.sectionSlug.replace(/-/g, " "), "guide", iconFor(category.title));

  for (const product of category.products) {
    const productPath = uniquePath("product", `${category.slug}-${product.name}`);
    product.image = productPath;
    product.imageAlt = `${product.name} brand-neutral illustration for ${category.title}`;
    writeVisual(productPath, product.name, category.title, "product", iconFor(`${product.name} ${category.title}`));
  }
}

for (const page of supportingPages) {
  const imagePath = uniquePath("support", page.slug);
  page.image = imagePath;
  writeVisual(imagePath, page.title, page.type, "support", iconFor(`${page.title} ${page.type}`));
}

const homeAssets = [
  ["home-hero", "Phavai", "Trust-first reviews", "home", "home"],
  ["home-outdoor", "Outdoor", "Running and trail gear", "home", "shoe"],
  ["home-remote-work", "Remote Work", "Desk and office gear", "home", "desk"],
  ["home-lifestyle", "Lifestyle", "Home and travel picks", "home", "luggage"]
];

for (const [slug, label, context, kind, icon] of homeAssets) {
  const path = uniquePath(slug, "visual");
  writeVisual(path, label, context, kind, icon);
}

writeFileSync(categoriesPath, `${JSON.stringify(categories, null, 2)}\n`, "utf8");
writeFileSync(sectionsPath, `${JSON.stringify(sections, null, 2)}\n`, "utf8");
writeFileSync(supportingPath, `${JSON.stringify(supportingPages, null, 2)}\n`, "utf8");
writeFileSync(imageSourcesPath, `${JSON.stringify(sourceEntries, null, 2)}\n`, "utf8");

console.log(`Generated ${usedPaths.size} unique Phavai-owned visuals.`);
