// app/lib/data.ts
import fs from "fs/promises";
import path from "path";
import type { Product } from "./types";

async function readJson<T>(p: string): Promise<T> {
  const file = await fs.readFile(p, "utf8");
  return JSON.parse(file) as T;
}

const root = process.cwd();

export async function getReviewerTiers() {
  const p = path.join(root, "data", "reviewer-tiers", "trail-running.json");
  return readJson<Record<string, { tier: 1 | 2 | 3; label: string }>>(p);
}

export async function getTrailMens(): Promise<Product[]> {
  const p = path.join(root, "data", "products", "trail-mens-2025.json");
  const items = await readJson<Product[]>(p);
  return items.sort((a, b) => b.bestPick - a.bestPick);
}

export async function getTrailWomens(): Promise<Product[]> {
  const p = path.join(root, "data", "products", "trail-womens-2025.json");
  const items = await readJson<Product[]>(p);
  return items.sort((a, b) => b.bestPick - a.bestPick);
}
