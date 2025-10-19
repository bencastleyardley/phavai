// app/api/top/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { query } = await req.json().catch(() => ({ query: "" }));
  // Very simple echo; real integration will call your analyzer here.
  const data = {
    query,
    picks: [
      {
        rank: 1,
        title: "Editor’s Pick Product",
        url: "#",
        price: "$199",
        score: 91,
        confidence: 0.83,
        badge: "Best Overall",
        highlights: ["Great build", "Strong reviews", "Good value"],
        sources: [
          { type: "review", count: 6 },
          { type: "reddit", count: 9 },
          { type: "youtube", count: 4 },
        ],
      },
      {
        rank: 2,
        title: "Value Hero Product",
        url: "#",
        price: "$129",
        score: 87,
        confidence: 0.8,
        badge: "Best Value",
        highlights: ["Affordable", "Reliable", "Popular choice"],
        sources: [
          { type: "review", count: 5 },
          { type: "reddit", count: 7 },
          { type: "youtube", count: 3 },
        ],
      },
    ],
  };
  return NextResponse.json(data);
}
