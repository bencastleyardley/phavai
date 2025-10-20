// app/api/analyze/route.ts
import { NextResponse } from "next/server";

type Item = {
  id: string;
  source: "reddit" | "youtube" | "web";
  title: string;
  url: string;
  author?: string;
  snippet?: string;
  views?: number;
  upvotes?: number;
  publishedAt?: string;
  score: number; // pre-score from /api/search
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function analyzeWithOpenAI(items: Item[], query: string) {
  if (!OPENAI_API_KEY) {
    // No key? Return pass-through with light, safe defaults.
    return items.map((it) => ({
      ...it,
      bestPickScore: it.score,
      pros: [],
      cons: [],
      verdict: "Sources collected. Add OPENAI_API_KEY for pros/cons & verdict.",
    }));
  }

  // Compact the payload for the model
  const compact = items.map((it) => ({
    title: it.title,
    url: it.url,
    source: it.source,
    snippet: it.snippet?.slice(0, 400) ?? "",
    views: it.views ?? 0,
    upvotes: it.upvotes ?? 0,
    publishedAt: it.publishedAt ?? "",
    preScore: it.score,
  }));

  const prompt = `
You are ranking products for the query: "${query}".
You get mixed sources (reddit, youtube, pro reviews). Task:
1) For EACH item, infer product name/model (be concise).
2) Derive 2-4 bullet Pros and 1-3 bullet Cons from the snippets/metadata (no hallucinations).
3) Compute a refined 0–100 "BestPick Score" that:
   - Starts from preScore (signal quality)
   - Adds points for consistent positive sentiment across sources
   - Slightly boosts recency and credible sources
4) Write a one-sentence "Verdict" for each item.
Return strict JSON: [{title, url, product, pros[], cons[], verdict, bestPickScore}]
If information is missing, leave fields minimal—DO NOT invent specs or quotes.
`;

  const body = {
    model: "gpt-4o-mini",
    temperature: 0.3,
    messages: [
      { role: "system", content: "Be precise, avoid speculation, and prefer trustworthy sourcing." },
      { role: "user", content: prompt },
      { role: "user", content: JSON.stringify(compact) },
    ],
    response_format: { type: "json_object" },
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const fail = await res.text();
    console.error("OpenAI error:", fail);
    return items.map((it) => ({
      ...it,
      bestPickScore: it.score,
      pros: [],
      cons: [],
      verdict: "Analysis unavailable (OpenAI error).",
    }));
  }

  const data = await res.json();
  // The model returns a JSON object; we'll expect { items: [...] } or just an array
  let parsed: any;
  try {
    parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
  } catch {
    parsed = {};
  }

  const arr: any[] = Array.isArray(parsed) ? parsed : parsed.items || [];

  // join back onto originals by url/title
  const map = new Map(items.map((i) => [`${i.title}|${i.url}`, i]));
  const enriched = arr.map((r) => {
    const key = `${r.title}|${r.url}`;
    const base = map.get(key) || items.find((i) => i.url === r.url) || {};
    return {
      ...base,
      product: r.product || base.title,
      pros: r.pros || [],
      cons: r.cons || [],
      verdict: r.verdict || "",
      bestPickScore: typeof r.bestPickScore === "number" ? Math.max(0, Math.min(100, r.bestPickScore)) : base.score,
    };
  });

  // Fallback in case of mismatch
  if (!enriched.length) {
    return items.map((it) => ({
      ...it,
      product: it.title,
      pros: [],
      cons: [],
      verdict: "",
      bestPickScore: it.score,
    }));
  }

  // Sort by refined score
  enriched.sort((a, b) => (b.bestPickScore ?? 0) - (a.bestPickScore ?? 0));
  return enriched.slice(0, 10);
}

export async function POST(req: Request) {
  const { items, query } = await req.json();
  if (!Array.isArray(items) || !query) {
    return NextResponse.json({ error: "Provide {items, query}" }, { status: 400 });
  }
  const enriched = await analyzeWithOpenAI(items, query);
  return NextResponse.json({ query, items: enriched });
}
