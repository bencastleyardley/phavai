import { copyFileSync, cpSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { basename, dirname, extname, resolve } from "node:path";

const projectRoot = resolve(process.cwd());
const outputRoot = resolve(projectRoot, "dist");

if (dirname(outputRoot) !== projectRoot || basename(outputRoot) !== "dist") {
  throw new Error(`Refusing to replace unexpected output directory: ${outputRoot}`);
}

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });

const publicExtensions = new Set([".css", ".html", ".js", ".svg", ".txt", ".xml"]);
const privateRootFiles = new Set(["operator-dashboard.html", "todays-picks.html"]);
const publicRootScripts = new Set(["affiliate-tracking.js", "fit-finder.js", "spec-database.js"]);

for (const entry of readdirSync(projectRoot, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const extension = extname(entry.name).toLowerCase();
  if (!publicExtensions.has(extension)) continue;
  if (privateRootFiles.has(entry.name)) continue;
  if (extension === ".js" && !publicRootScripts.has(entry.name)) continue;
  copyFileSync(resolve(projectRoot, entry.name), resolve(outputRoot, entry.name));
}

for (const directory of ["photos", "downloads"]) {
  cpSync(resolve(projectRoot, directory), resolve(outputRoot, directory), { recursive: true });
}

console.log(`Prepared public deployment in ${outputRoot}`);
