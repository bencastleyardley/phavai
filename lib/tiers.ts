import fs from "node:fs";
import path from "node:path";

export type Tier = { tier: number; label: string; emoji: string; why_trusted: string; domains: string[] };
export type TierConfig = { vertical: string; tiers: Tier[] };

let cache: Record<string, TierConfig> | null = null;

export function loadTierConfig(vertical: string): TierConfig {
  if (!cache) cache = {};
  if (!cache[vertical]) {
    const file = path.join(process.cwd(), "data", "reviewers", `${vertical}.tiers.json`);
    cache[vertical] = JSON.parse(fs.readFileSync(file, "utf-8")) as TierConfig;
  }
  return cache[vertical];
}

export function tierForDomain(vertical: string, domain: string): Tier | null {
  const cfg = loadTierConfig(vertical);
  for (const t of cfg.tiers) {
    if (t.domains.includes(domain)) return t;
  }
  return null;
}
