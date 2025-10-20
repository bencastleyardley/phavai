import { NextResponse } from "next/server";
import curated from "@/data/curated.json";

type SourceMix = { type: "reddit" | "youtube" | "review" | "other"; count: number };
type PickItem = {
  rank: number; title: string; url?: string; image?: string; price?: string;
  score: number; confidence: number; badge?: "Best Overall" | "Best Value" | null;
  highlights?: string[]; sources?: SourceMix[];
};
type TopResponse = { query: string; picks: PickItem[] };

function slugify(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,""); }

function chooseCurated(q: string): PickItem[] | null {
  const t = q.toLowerCase();
  if ((t.includes("trail") && t.includes("shoe")) || t.includes("prodigio") || t.includes("speedgoat")) {
    return (curated as any).trail_running_shoes;
  }
  if (t.includes("treadmill") || t.includes("compact treadmill") || t.includes("small spaces")) {
    return (curated as any).compact_treadmills;
  }
  if ((t.includes("budget") && (t.includes("watch") || t.includes("smartwatch"))) || t.includes("forerunner") || t.includes("pace 3")) {
    return (curated as any).budget_running_watches;
  }
  if ((t.includes("headphone") || t.includes("headphones")) && (t.includes("everyday") || t.includes("wireless") || t.includes("anc"))) {
    return (curated as any).everyday_headphones;
  }
  return null;
}

/** Optional: simple AI fallback if OPENAI_API_KEY is present. */
async function aiBackfill(query: string): Promise<PickItem[] | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const prompt = `Return JSON with key "picks": top 3 consumer products for: "${query}".
  Each item: { rank, title, price (string like "$199"), score (0-100), confidence (0-1),
  badge ("Best Overall"|"Best Value"|null), highlights [3 strings], sources [{type, count}] }.
  Be concise, realistic brand/model names, no prose.`;

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "authorization": `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: "You are a product meta-aggregator. Output only valid JSON." },
                   { role: "user", content: prompt }],
        temperature: 0.6
      })
    });

    if (!r.ok) return null;
    const json = await r.json();
    const text = json.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(text);
    if (!parsed?.picks || !Array.isArray(parsed.picks)) return null;
    // Light sanitize & rank
    return parsed.picks.slice(0,3).map((p: any, i: number) => ({
      rank: p.rank ?? i+1,
      title: String(p.title ?? "").slice(0,120),
      price: typeof p.price === "string" ? p.price : undefined,
      score: Math.max(0, Math.min(100, Number(p.score ?? 80))),
      confidence: Math.max(0, Math.min(1, Number(p.confidence ?? 0.75))),
      badge: p.badge === "Best Overall" || p.badge === "Best Value" ? p.badge : null,
      highlights: Array.isArray(p.highlights) ? p.highlights.slice(0,3) : [],
      sources: Array.isArray(p.sources) ? p.sources.slice(0,3) : [{type:"review",count:5}]
    }));
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const { query } = await req.json().catch(() => ({ query: "" }));
  const q = String(query ?? "").trim();
  if (!q) return NextResponse.json({ query: "", picks: [] } satisfies TopResponse);

  // 1) Curated matches first (instant, high-quality demo)
  const curatedPicks = chooseCurated(q);
  if (curatedPicks) return NextResponse.json({ query: q, picks: curatedPicks } satisfies TopResponse);

  // 2) AI fallback if key provided
  const ai = await aiBackfill(q);
  if (ai) return NextResponse.json({ query: q, picks: ai } satisfies TopResponse);

  // 3) Last-resort, friendly placeholder so UI never 0-results
  const placeholder: PickItem[] = [
    {
      rank: 1, title: `Top pick for “${q}”`, price: "$199", score: 90, confidence: 0.8, badge: "Best Overall",
      highlights: ["Strong sentiment", "Recent reviews", "Great value"], sources: [{type:"review",count:6},{type:"reddit",count:9}]
    },
    { rank: 2, title: `Great value for “${q}”`, price: "$129", score: 86, confidence: 0.78, badge: "Best Value",
      highlights: ["Affordable", "Reliable", "Popular"], sources: [{type:"review",count:5},{type:"reddit",count:7}] },
    { rank: 3, title: `Solid alternative for “${q}”`, price: "$159", score: 84, confidence: 0.75,
      highlights: ["Well-reviewed", "Balanced features", "Good support"], sources: [{type:"review",count:4},{type:"reddit",count:6}] }
  ];
  return NextResponse.json({ query: q, picks: placeholder } satisfies TopResponse);
}
