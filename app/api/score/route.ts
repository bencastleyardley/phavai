import { NextResponse } from "next/server";
import {
  SourceItem, ScorePayload, aggregateScore, to100, bucketScore, overallConfidence
} from "@/lib/score";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { query = "" } = (await req.json().catch(() => ({}))) as { query?: string };
  const q = query?.trim();
  if (!q) return NextResponse.json({ error: "Query required" }, { status: 400 });

  // ---- MOCK: replace with real ingestion later ----
  const mock: SourceItem[] = [
    { id: "p1", type: "pro", title: "Wirecutter roundup", url: "#", sentiment: 1,   confidence: 0.9, ageDays: 40,  credibility: 0.95 },
    { id: "p2", type: "pro", title: "OutdoorGear Pro review", url: "#", sentiment: 0.5, confidence: 0.8, ageDays: 10,  credibility: 0.9 },
    { id: "r1", type: "reddit", title: "r/trailrunning thread", url: "#", sentiment: 0.5, confidence: 0.7, ageDays: 7,   credibility: 0.7 },
    { id: "r2", type: "reddit", title: "r/Ultrarunning shoe poll", url: "#", sentiment: 0,   confidence: 0.6, ageDays: 3,   credibility: 0.65 },
    { id: "f1", type: "forum", title: "RunForum durability post", url: "#", sentiment: -0.5,confidence: 0.8, ageDays: 20,  credibility: 0.8 },
    { id: "y1", type: "youtube", title: "GingerRunner review", url: "#", sentiment: 1,   confidence: 0.85,ageDays: 12,  credibility: 0.85 },
    { id: "y2", type: "youtube", title: "Kofuzi comparison", url: "#", sentiment: 0.5, confidence: 0.75,ageDays: 5,   credibility: 0.85 },
  ];
  // -----------------------------------------------

  const agg = aggregateScore(mock);
  const payload: ScorePayload = {
    query: q,
    bestPickScore: to100(agg.score01),
    confidence: to100(overallConfidence(mock)),
    buckets: {
      pro: bucketScore(mock, "pro"),
      reddit: bucketScore(mock, "reddit"),
      forum: bucketScore(mock, "forum"),
      youtube: bucketScore(mock, "youtube"),
    },
    sources: mock,
    notes: [
      "Score blends sentiment with recency, credibility, and model confidence.",
      "Confidence reflects agreement across sources and effective sample size.",
    ],
  };

  return NextResponse.json(payload);
}
