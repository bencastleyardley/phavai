// app/lib/score.ts
export type ScoreBuckets = {
  published: number;
  reddit: number;
  youtube: number;
  social: number;
};

export function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

export function bestPickAverage(s: ScoreBuckets) {
  const avg = (s.published + s.reddit + s.youtube + s.social) / 4;
  return Math.round(clamp(avg));
}

export function sentimentIcon(n: number) {
  if (n >= 85) return "☀️";
  if (n >= 70) return "🌤️";
  if (n >= 55) return "☁️";
  return "🌧️";
}
