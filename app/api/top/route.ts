import { NextResponse } from "next/server";

type Buckets = { pro: number; reddit: number; forum: number; youtube: number };
type TopItem = {
  id: string;
  name: string;
  score: number;       // 0–100
  confidence: number;  // 0–100
  buckets: Buckets;
};

function make(name: string, score: number, confidence: number, buckets: Buckets, i: number): TopItem {
  return { id: `i${i}`, name, score, confidence, buckets };
}

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { query = "" } = (await req.json().catch(() => ({}))) as { query?: string };
  const q = query.trim();
  if (!q) return NextResponse.json({ error: "Query required" }, { status: 400 });

  // MOCK generator: pretend we searched and found 10 products for this query
  // (Later this will call real fetchers. Names include the query so it's obvious.)
  const seed = [
    ["Pro 3", 92, 86, { pro: 95, reddit: 88, forum: 80, youtube: 90 }],
    ["Elite 2", 89, 83, { pro: 90, reddit: 86, forum: 78, youtube: 88 }],
    ["Max 5",  88, 81, { pro: 92, reddit: 82, forum: 75, youtube: 89 }],
    ["Ultra",  87, 78, { pro: 88, reddit: 80, forum: 76, youtube: 84 }],
    ["X2",     85, 77, { pro: 86, reddit: 79, forum: 70, youtube: 83 }],
    ["Carbon", 84, 75, { pro: 85, reddit: 77, forum: 69, youtube: 82 }],
    ["Flow",   82, 73, { pro: 81, reddit: 75, forum: 68, youtube: 80 }],
    ["Lite",   81, 72, { pro: 82, reddit: 74, forum: 67, youtube: 79 }],
    ["G 270",  80, 71, { pro: 80, reddit: 73, forum: 66, youtube: 78 }],
    ["Trail",  79, 70, { pro: 79, reddit: 72, forum: 65, youtube: 77 }],
  ] as const;

  const items = seed.map((s, i) => make(`${q} — ${s[0]}`, s[1], s[2], s[3], i + 1));

  return NextResponse.json({ query: q, items });
}
