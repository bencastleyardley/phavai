// lib/fetchTop.ts
export type SourceMix = { type: "reddit" | "youtube" | "review" | "other"; count: number };
export type PickItem = {
  rank: number;
  title: string;
  url?: string;
  image?: string;
  price?: string;
  score: number;        // 0-100
  confidence: number;   // 0-1
  badge?: "Best Overall" | "Best Value" | null;
  highlights?: string[];
  sources?: SourceMix[];
};

export type TopResponse = {
  query: string;
  picks: PickItem[];
};

const mock: TopResponse = {
  query: "best trail running shoes 2025",
  picks: [
    {
      rank: 1,
      title: "La Sportiva Prodigio Pro",
      url: "#",
      price: "$199",
      score: 92,
      confidence: 0.84,
      badge: "Best Overall",
      highlights: ["Fast, stable midsole", "Excellent grip on wet rock", "Durable upper"],
      sources: [
        { type: "review", count: 8 },
        { type: "reddit", count: 12 },
        { type: "youtube", count: 5 },
      ],
    },
    {
      rank: 2,
      title: "Saucony Peregrine",
      url: "#",
      price: "$140",
      score: 88,
      confidence: 0.81,
      badge: "Best Value",
      highlights: ["Great all-rounder", "Protective rock plate", "Broad fit range"],
      sources: [
        { type: "review", count: 6 },
        { type: "reddit", count: 10 },
        { type: "youtube", count: 4 },
      ],
    },
    {
      rank: 3,
      title: "HOKA Speedgoat",
      url: "#",
      price: "$155",
      score: 86,
      confidence: 0.79,
      highlights: ["Cushioned for ultra distance", "Vibram grip", "Locks heel well"],
      sources: [
        { type: "review", count: 7 },
        { type: "reddit", count: 9 },
        { type: "youtube", count: 4 },
      ],
    },
  ],
};

export async function fetchTopPicks(query: string): Promise<TopResponse> {
  try {
    const res = await fetch("/api/top", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as TopResponse;

    // Light validation
    if (!data?.picks || !Array.isArray(data.picks)) throw new Error("Bad data shape");
    return data;
  } catch {
    // Fallback so UI always shows something
    return { ...mock, query };
  }
}
