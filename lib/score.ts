// lib/score.ts
export type SourceType = "pro" | "reddit" | "forum" | "youtube";
export type Sentiment = -1 | -0.5 | 0 | 0.5 | 1;

export interface SourceItem {
  id: string;
  type: SourceType;
  title: string;
  url: string;
  excerpt?: string;
  // sentiment in [-1,1] using a small discrete set for stability
  sentiment: Sentiment;
  // model’s confidence in sentiment label (0–1)
  confidence: number;
  // age in days; 0 = today
  ageDays: number;
  // channel credibility 0–1 (editorial standards, identity, quality)
  credibility: number;
}

export interface ScorePayload {
  query: string;
  bestPickScore: number;   // 0–100
  confidence: number;      // 0–100 (how consistent sources are + volume)
  buckets: {
    pro: number; reddit: number; forum: number; youtube: number; // 0–100 each
  };
  sources: SourceItem[];
  notes?: string[];
}

// ---- scoring knobs (edit to taste) ----
const BASE_WEIGHTS: Record<SourceType, number> = {
  pro: 1.0,       // professional reviews
  reddit: 0.8,    // crowdsourced expertise
  forum: 0.7,     // brand/community forums
  youtube: 0.85,  // influencer/explainer
};

const HALF_LIFE_DAYS = 120; // recency half-life for decay
const MIN_CONFIDENCE = 0.35; // floor to avoid zeroing weak items

export function recencyDecay(ageDays: number) {
  // Exponential half-life decay: weight = 0.5^(age/halfLife)
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

export function itemWeight(s: SourceItem) {
  const base = BASE_WEIGHTS[s.type];
  const recency = recencyDecay(s.ageDays);
  const conf = Math.max(MIN_CONFIDENCE, s.confidence);
  const cred = s.credibility; // already 0–1
  return base * recency * conf * cred;
}

export function sentimentTo01(sent: number) {
  // map [-1,1] -> [0,1]
  return (sent + 1) / 2;
}

export function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

export function aggregateScore(sources: SourceItem[]) {
  if (!sources.length) return { score01: 0.5, weightedN: 0, variance: 0 };
  let sumW = 0, sumWSent01 = 0;
  const vals: number[] = [];
  for (const s of sources) {
    const w = itemWeight(s);
    const v = sentimentTo01(s.sentiment);
    sumW += w;
    sumWSent01 += w * v;
    vals.push(v);
  }
  const score01 = sumW > 0 ? sumWSent01 / sumW : 0.5;
  // simple variance (unweighted) for consistency → feeds “confidence”
  const mean = vals.reduce((a,b)=>a+b,0)/vals.length;
  const variance = vals.reduce((a,b)=>a + (b-mean)*(b-mean),0)/vals.length;
  return { score01: clamp01(score01), weightedN: sumW, variance: clamp01(variance) };
}

export function to100(x01: number) { return Math.round(x01 * 100); }

export function bucketScore(sources: SourceItem[], type: SourceType) {
  const subset = sources.filter(s => s.type === type);
  return to100(aggregateScore(subset).score01);
}

export function overallConfidence(sources: SourceItem[]) {
  if (!sources.length) return 0.0;
  const { weightedN, variance } = aggregateScore(sources);
  // confidence grows with signal (weightedN) and declines with disagreement (variance)
  // simple blend normalized with soft caps
  const volume = Math.min(1, weightedN / 8); // soft cap at ~8 “effective” items
  const agreement = 1 - Math.min(1, variance * 2); // convert variance [0,1] → [1..0]
  return clamp01(0.6 * agreement + 0.4 * volume);
}
