import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const ok = Boolean(process.env.OPENAI_API_KEY?.trim());
  return NextResponse.json({
    ok,
    message: ok
      ? "API key found. Server is healthy."
      : "No OPENAI_API_KEY found. Add it to .env.local",
  });
}
