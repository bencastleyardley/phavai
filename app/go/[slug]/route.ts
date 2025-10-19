import { NextResponse } from "next/server";
import { resolveAffiliate } from "@/lib/affiliate";

export async function GET(_: Request, { params }: { params: { slug: string } }) {
  const url = resolveAffiliate(params.slug);
  return NextResponse.redirect(url, { status: 302 });
}
