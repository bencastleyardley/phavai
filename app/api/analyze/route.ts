// app/api/analyze/route.ts
import { NextResponse } from "next/server";

type Source = "reddit" | "youtube" | "web";

export type Item = {
  id: string;
  source: Source;
  title: string;
  url: string;
  author?: string;
  thumbnail?: string;
  snippet?: string;
  publishedAt?: string;
  upvotes?: number;
  views?: number;
  score: number; // pre-score from /api/search
};

type CompactForLLM = {
  title: string;
  url: string;
  source: Source;
  snippet: string;
  views: number;
  upvotes: number;
  publishedAt: string;
  preScore: number;
};

type LLMItem = {
  title?: string;
  url?: string;
  product?: string;
  pros?: string[];
  cons?: string[];
  verdict?: string;
  bestPickScore?: number;
};

type EnrichedItem = Item & {
  product: string;
  pros: string[];
  cons: string[];
  verdict: string;
  bestPickScore: number;
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function compactItems(items: Item[]): CompactForLLM[] {
  return items.map((it) => ({
    title: it.title,
    url: it.url,
    source: it.source,
    snippet: (it.snippet ?? "").slice(0, 400),
    views: it.views ?? 0,
    upvotes: it.upvotes ?? 0,
    publishedAt: it.publishedAt ?? "",
    preScore: it.score,
  }));
}

async function callOpenAI(items: Item[], query: string): Promise<LLMItem[]> {
  if (!OPENAI_API_KEY) return [];

  const prompt = `
You are ranking products for the query: "${query}" using mixed sources (reddit/youtube/pro reviews).
For EACH item, do the following strictly based on provided snippets/metadata (no invention):
1) Infer a concise product name/model in "product".
2) Provide 2–4 Pros and 1–3 Cons (short bullets).
3) Compute a refined 0–100 "bestPickScore" that starts from "preScore", rewarding consistent positive signals and recency.
4) Write a one-sentence "verdict".

Return JSON as: { "items": [ { "title": "...", "url": "...", "product": "...", "pros": ["..."], "cons": ["..."], "verdict": "...", "bestPickScore": 87 } ] }
If unsure, leave arrays empty and keep bestPickScore close to preScore.
`;

  const body = {
    model: "gpt-4o-mini",
    temperature: 0.3,
    messages: [
      { role: "system", content: "Be precise, avoid speculation, and never invent specs or quotes." },
      { role: "user", content: prompt },
      { role: "user", content: JSON.stringify(compactItems(items)) },
    ],
    response_format: { type: "json_object" as const },
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
    console.error("OpenAI error:", await res.text());
    return [];
  }

  const data = await res.json();
  let parsed: any = {};
  try {
    parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
  } catch (e) {
    console.error("JSON parse error from OpenAI:", e);
  }
  const arr: LLMItem[] = Array.isArray(parsed?.items) ? parsed.items : [];
  return arr;
}

function safeBaseFromLLMOrItems(
  r: LLMItem,
  items: Item[],
  idx: number
): Item {
  // Try to find the original by exact (title|url), then by url, then by title.
  const exact = items.find((i) => i.title === r.title && i.url === r.url);
  if (exact) return exact;

  if (r.url) {
    const byUrl = items.find((i) => i.url === r.url);
    if (byUrl) return byUrl;
  }

  if (r.title) {
    const byTitle = items.find((i) => i.title === r.title);
    if (byTitle) return byTitle;
  }

  // Fallback base if we can’t match: still return a fully-typed item
  return {
    id: `fallback_${idx}`,
    source: "web",
    title: r.title || "Untitled",
    url: r.url || "",
    score: 50,
  };
}

async function analyzeWithOpenAI(items: Item[], query: string): Promise<EnrichedItem[]> {
  // If no key, just pass-through
  if (!OPENAI_API_KEY) {
    return items.map<EnrichedItem>((it) => ({
      ...it,
      product: it.title,
      pros: [],
      cons: [],
      verdict: "Add OPENAI_API_KEY for pros/cons & verdict.",
      bestPickScore: clamp(it.score, 0, 100),
    }));
  }

  const llmItems = await callOpenAI(items, query);

  // If the LLM returned nothing usable, pass-through
  if (!llmItems.length) {
    return items.map<EnrichedItem>((it) => ({
      ...it,
      product: it.title,
      pros: [],
      cons: [],
      verdict: "",
      bestPickScore: clamp(it.score, 0, 100),
    }));
  }

  // Merge LLM output back onto originals—SAFELY TYPED
  const enriched: EnrichedItem[] = llmItems.map((r, i) => {
    const base: Item = safeBaseFromLLMOrItems(r, items, i);

    const bestPickScore =
      typeof r.bestPickScore === "number" ? clamp(r.bestPickScore, 0, 100) : clamp(base.score, 0, 100);

    return {
      ...base,
      product: r.product || base.title,
      pros: Array.isArray(r.pros) ? r.pros : [],
      cons: Array.isArray(r.cons) ? r.cons : [],
      verdict: r.verdict || "",
      bestPickScore,
    };
  });

  // Ensure at least 10 sorted by score (fill from originals if needed)
  const fillSet = new Set(enriched.map((e) => e.id));
  for (const it of items) {
    if (enriched.length >= 10) break;
    if (!fillSet.has(it.id)) {
      enriched.push({
        ...it,
        product: it.title,
        pros: [],
        cons: [],
        verdict: "",
        bestPickScore: clamp(it.score, 0, 100),
      });
    }
  }

  enriched.sort((a, b) => b.bestPickScore - a.bestPickScore);
  return enriched.slice(0, 10);
}

export async function POST(req: Request) {
  try {
    const { items, query } = await req.json();
    if (!Array.isArray(items) || !query) {
      return NextResponse.json({ error: "Provide {items, query}" }, { status: 400 });
    }
    const typedItems: Item[] = items.map((i: any) => ({
      id: String(i.id),
      source: (i.source as Source) ?? "web",
      title: String(i.title ?? "Untitled"),
      url: String(i.url ?? ""),
      author: i.author,
      thumbnail: i.thumbnail,
      snippet: i.snippet,
      publishedAt: i.publishedAt,
      upvotes: typeof i.upvotes === "number" ? i.upvotes : undefined,
      views: typeof i.views === "number" ? i.views : undefined,
      score: typeof i.score === "number" ? i.score : 50,
    }));

    const enriched = await analyzeWithOpenAI(typedItems, String(query));
    return NextResponse.json({ query, items: enriched });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Analyze failed" }, { status: 500 });
  }
}
