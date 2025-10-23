import { readFileSync, writeFileSync } from "node:fs";
import he from "he";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Usage: node scripts/normalize-html.mjs <file1.html> <file2.html> ...");
  process.exit(1);
}

for (const f of files) {
  let raw = readFileSync(f, "utf8");

  // Repair classic mojibake if markers exist (Ã, Â)
  if (/[ÃÂ]/.test(raw)) {
    const bytesLatin1 = Buffer.from(raw, "binary");
    raw = Buffer.from(bytesLatin1.toString("latin1"), "utf8").toString();
  }

  // Ensure charset meta
  if (!/<meta\s+charset=/i.test(raw)) {
    raw = raw.replace(/<\/head>/i, '<meta charset="utf-8" /></head>');
  }

  // Normalize punctuation -> entities (unicode + mojibake)
  const map = new Map(Object.entries({
    "—":"&mdash;","–":"&ndash;","•":"&bull;","→":"&rarr;",
    "“":"&ldquo;","”":"&rdquo;","‘":"&lsquo;","’":"&rsquo;",
    "â€”":"&mdash;","â€“":"&ndash;","â€¢":"&bull;","â†’":"&rarr;",
    "â€œ":"&ldquo;","â€":"&rdquo;","â€�":"&rdquo;","â€˜":"&lsquo;","â€™":"&rsquo;"
  }));
  for (const [bad, good] of map) raw = raw.split(bad).join(good);

  // Safe CSS bullet (text)
  raw = raw.replace(/content:"•";/g, 'content:"\\2022";')
           .replace(/content:"â€¢";/g, 'content:"\\2022";');

  // Decode then re-encode cleanly (stabilizes mixed entities)
  raw = he.encode(he.decode(raw), { useNamedReferences: true });

  writeFileSync(f, raw, { encoding: "utf8" });
  console.log("Normalized:", f);
}