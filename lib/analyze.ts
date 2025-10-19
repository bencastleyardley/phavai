// lib/analyze.ts
import type { AnalysisResult } from "@/types/domain";

export async function runAnalyze(query: string): Promise<AnalysisResult> {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Analyze failed with ${res.status}`);
  }
  return (await res.json()) as AnalysisResult;
}
