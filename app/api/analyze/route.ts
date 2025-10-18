import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { query = "" } = body as { query?: string };

    if (!process.env.OPENAI_API_KEY?.trim()) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY" },
        { status: 500 }
      );
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Minimal “does it work” call — replace with your real logic later.
    const summary = query
      ? `Pretend analysis of: ${query}`
      : "Send { query: string } in the POST body.";

    // Example OpenAI call (safe, no actual model call if you’re not ready):
    // const completion = await client.chat.completions.create({
    //   model: "gpt-4o-mini",
    //   messages: [{ role: "user", content: `Summarize: ${query}` }],
    // });

    return NextResponse.json({ ok: true, summary });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
