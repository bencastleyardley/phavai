import { readFileSync, writeFileSync } from "node:fs";
import ejs from "ejs";

const data = JSON.parse(readFileSync("data/trail.json", "utf8"));
const template = readFileSync("templates/category.ejs", "utf8");
const html = ejs.render(template, data, { rmWhitespace: true });

writeFileSync(`${data.slug}.html`, html, { encoding: "utf8" });
console.log("Built:", `${data.slug}.html`);