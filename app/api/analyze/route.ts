// app/api/analyze/route.ts
import { NextResponse } from "next/server";
import type { AnalysisResult } from "@/types/domain";

export async function POST(req: Request) {
  try {
    const { query } = (await req.json()) as { query?: string };
    const prompt = (query || "").toString().slice(0, 300);

    const key = process.env.OPENAI_API_KEY?.trim();

    if (!key) {
      // No key configured — return a clean mock
      const mock = mockAnalysis(prompt || "Unknown item");
      return NextResponse.json(mock, { headers: { "x-phavai-mode": "mock-no-key" } });
    }

    // Try OpenAI call
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are Phavai. Return ONLY valid JSON with: { summary, bestPick:{score,confidence,breakdown:{publishedReviews,redditSentiment,videoSentiment,recencyBoost}}, sources:[{name,url,weight,sentiment,snippet}] }.",
          },
          {
            role: "user",
            content:
              `Aggregate sentiment for: "${prompt || "generic product"}". Estimate a transparent score and confidence.`,
          },
        ],
      }),
    });

    if (!resp.ok) {
      // If invalid key/unauthorized/etc — fall back silently to mock
      const status = resp.status;
      let note = `mock-openai-error-${status}`;
      try {
        const t = await resp.text();
        if (/invalid_api_key|Incorrect API key/i.test(t)) note = "mock-invalid-api-key";
      } catch {}
      const fallback = mockAnalysis(prompt || "Unknown item");
      return NextResponse.json(fallback, { headers: { "x-phavai-mode": note } });
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content?.trim();

    let parsed: AnalysisResult | null = null;
    try {
      parsed = content ? JSON.parse(content) : null;
    } catch {
      parsed = null;
    }

    if (parsed && isAnalysisResult(parsed)) {
      return NextResponse.json(parsed, { headers: { "x-phavai-mode": "openai" } });
    }

    // Model returned non-JSON → use mock
    const fallback = mockAnalysis(prompt || "Unknown item");
    return NextResponse.json(fallback, { headers: { "x-phavai-mode": "mock-nonjson" } });
  } catch (err) {
    const mock = mockAnalysis("Unknown item");
    return NextResponse.json(mock, { headers: { "x-phavai-mode": "mock-exception" } });
  }
}

/** Narrow type check */
function isAnalysisResult(x: any): x is AnalysisResult {
  return !!(
    x &&
    typeof x.summary === "string" &&
    x.bestPick &&
    typeof x.bestPick.score === "number" &&
    x.bestPick.breakdown
  );
}

/** Demo/mock data */
function mockAnalysis(name: string): AnalysisResult {
  const score = 86;
  return {
    summary:
      `Overall sentiment for “${name}” trends positive. Reviewers praise performance and value; minor critiques cite availability and learning curve.`,
    bestPick: {
      score,
      confidence: 82,
      breakdown: {
        publishedReviews: 88,
        redditSentiment: 83,
        videoSentiment: 84,
        recencyBoost: 76,
      },
    },
    sources: [
      {
        name: "Trusted Reviews",
        url: "https://example.com/trusted-reviews",
        weight: 0.35,
        sentiment: "positive",
        snippet: "Strong performance-to-price ratio; consistent reliability.",
      },
      {
        name: "Reddit",
        url: "https://reddit.com/r/product",
        weight: 0.30,
        sentiment: "positive",
        snippet: "Most users recommend it after hands-on use.",
      },
      {
        name: "YouTube",
        url: "https://youtube.com/watch?v=xxxxx",
        weight: 0.25,
        sentiment: "neutral",
        snippet: "Good overview; notes learning curve for first-time users.",
      },
      {
        name: "Recent Mentions",
        weight: 0.10,
        sentiment: "positive",
        snippet: "Momentum rising in the past 60 days.",
      },
    ],
  };
}
