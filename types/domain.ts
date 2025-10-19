// types/domain.ts
export type Source = {
  name: string;           // e.g., Reddit, YouTube, Trusted Reviews
  url?: string;
  weight: number;         // 0..1 influence
  sentiment: "positive" | "neutral" | "negative";
  snippet?: string;
};

export type ScoreBreakdown = {
  publishedReviews: number;  // 0..100
  redditSentiment: number;   // 0..100
  videoSentiment: number;    // 0..100
  recencyBoost: number;      // 0..100
};

export type BestPickScore = {
  score: number;             // 0..100
  confidence: number;        // 0..100
  breakdown: ScoreBreakdown;
};

export type AnalysisResult = {
  summary: string;
  bestPick: BestPickScore;
  sources: Source[];
};

export type Tile = {
  id: string;
  title: string;
  buckets: string[];
  price: number | string;
  badges?: string[];
  references?: string[];
  onAnalyze?: () => void;
  analysis?: AnalysisResult;
  isLoading?: boolean;
  error?: string | null;
};
