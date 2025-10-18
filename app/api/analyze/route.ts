import { NextResponse } from "next/server";

export const runtime = "nodejs";

type AnalyzeBody = { query?: string };

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as AnalyzeBody;
    const query = body?.query?.trim() ?? "";

    if (!process.env.OPENAI_API_KEY?.trim()) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    const summary = query
      ? `Pretend analysis of: ${query}`
      : "Send { query: string } in the POST body.";

    return NextResponse.json({ ok: true, summary });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
