import { readFileSync, writeFileSync } from "node:fs";
import ejs from "ejs";

// Read JSON and strip an optional UTF-8 BOM
const json = readFileSync("data/trail.json", "utf8").replace(/^\uFEFF/, "");
const data = JSON.parse(json);

const tpl  = readFileSync("templates/category.ejs", "utf8");
const html = ejs.render(tpl, data, { rmWhitespace: true });

writeFileSync(`${data.slug}.html`, html, { encoding: "utf8" });
console.log("Built:", `${data.slug}.html`);