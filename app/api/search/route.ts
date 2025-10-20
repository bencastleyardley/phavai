// app/api/search/route.ts
import { NextResponse } from "next/server";

type RawItem = {
  id: string;
  source: "reddit" | "youtube" | "web";
  title: string;
  url: string;
  author?: string;
  thumbnail?: string;
  snippet?: string;
  publishedAt?: string; // ISO
  upvotes?: number;     // reddit
  views?: number;       // youtube
};

type ScoredItem = RawItem & { score: number };

const YT_KEY = process.env.YOUTUBE_API_KEY;
const SERPER_KEY = process.env.SERPER_API_KEY;
const AFFIL_TAG = process.env.AFFIL_TAG || "";

function daysSince(dateIso?: string) {
  if (!dateIso) return 365;
  const d = new Date(dateIso).getTime();
  if (Number.isNaN(d)) return 365;
  return Math.max(1, (Date.now() - d) / (1000 * 60 * 60 * 24));
}

// Simple, transparent scoring: engagement + freshness
function bestPickScore(item: RawItem): number {
  const engagement =
    (item.upvotes ?? 0) * 1.0 +
    (item.views ? Math.log10(Math.max(1, item.views)) * 8 : 0);

  const freshness = 40 / Math.sqrt(daysSince(item.publishedAt));
  const baseSource = item.source === "web" ? 12 : item.source === "reddit" ? 10 : 8;

  return Math.round(baseSource + engagement + freshness);
}

function toAmazonAffiliate(url: string): string {
  try {
    const u = new URL(url);
    if (AFFIL_TAG && (u.hostname.includes("amazon.") || u.hostname === "amzn.to")) {
      if (!u.searchParams.has("tag")) u.searchParams.set("tag", AFFIL_TAG);
      return u.toString();
    }
  } catch {}
  return url;
}

async function fetchReddit(q: string): Promise<RawItem[]> {
  // Reddit’s “old” JSON endpoint is stable and keyless
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(q)}&sort=top&t=year&limit=10`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) return [];
  const data = await res.json();
  const posts = data?.data?.children ?? [];
  return posts.map((p: any): RawItem => {
    const d = p.data;
    return {
      id: `rdt_${d.id}`,
      source: "reddit",
      title: d.title,
      url: `https://www.reddit.com${d.permalink}`,
      author: d.author,
      thumbnail: d.thumbnail && d.thumbnail.startsWith("http") ? d.thumbnail : undefined,
      snippet: d.selftext ? d.selftext.slice(0, 220) : undefined,
      publishedAt: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : undefined,
      upvotes: d.ups ?? d.score ?? 0,
    };
  });
}

async function fetchYouTube(q: string): Promise<RawItem[]> {
  if (!YT_KEY) return [];
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(
    q
  )}&key=${YT_KEY}`;
  const res = await fetch(url, { next: { revalidate: 600 } });
  if (!res.ok) return [];
  const data = await res.json();

  const items = data?.items ?? [];
  const ids = items.map((it: any) => it.id?.videoId).filter(Boolean);
  if (ids.length === 0) return [];

  // Get stats for views
  const statsRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${ids.join(",")}&key=${YT_KEY}`,
    { next: { revalidate: 600 } }
  );
  const statsData = statsRes.ok ? await statsRes.json() : { items: [] };

  const statMap = new Map<string, any>();
  for (const v of statsData.items ?? []) statMap.set(v.id, v);

  return items.map((it: any): RawItem => {
    const vid = it.id?.videoId;
    const s = statMap.get(vid);
    return {
      id: `yt_${vid}`,
      source: "youtube",
      title: it.snippet?.title ?? "YouTube video",
      url: `https://www.youtube.com/watch?v=${vid}`,
      author: it.snippet?.channelTitle,
      thumbnail: it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url,
      snippet: it.snippet?.description?.slice(0, 220),
      publishedAt: it.snippet?.publishedAt,
      views: s?.statistics?.viewCount ? Number(s.statistics.viewCount) : undefined,
    };
  });
}

async function fetchWeb(q: string): Promise<RawItem[]> {
  // Use Serper for clean web results (NYT/Wired/tech sites/review sites) if available
  if (!SERPER_KEY) return [];
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": SERPER_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q, num: 10 }),
    next: { revalidate: 900 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const results = data?.organic ?? [];
  return results.map((r: any, i: number): RawItem => ({
    id: `web_${i}_${r.position}`,
    source: "web",
    title: r.title,
    url: r.link,
    author: r.source,
    snippet: r.snippet,
    thumbnail: r.favicons?.high_res || r.favicons?.low_res,
    // We often don't have exact publish dates; score() will handle missing dates gracefully.
  }));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  if (!q) {
    return NextResponse.json({ items: [], query: "", note: "Provide ?q=" });
  }

  // Fetch sources concurrently
  const [rdt, yt, web] = await Promise.all([
    fetchReddit(q).catch(() => []),
    fetchYouTube(q).catch(() => []),
    fetchWeb(q).catch(() => []),
  ]);

  const all: ScoredItem[] = [...rdt, ...yt, ...web].map((it) => ({
    ...it,
    url: toAmazonAffiliate(it.url),
    score: bestPickScore(it),
  }));

  // De-dup by URL host+title to avoid near-duplicates across sources
  const seen = new Set<string>();
  const unique = all.filter((it) => {
    const key = `${new URL(it.url).hostname}-${it.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Rank + Top 10
  unique.sort((a, b) => b.score - a.score);
  const top10 = unique.slice(0, 10);

  return NextResponse.json({
    query: q,
    items: top10,
    counts: { reddit: rdt.length, youtube: yt.length, web: web.length },
  });
}
