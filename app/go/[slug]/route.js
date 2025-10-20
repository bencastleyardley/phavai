import { NextResponse } from "next/server";
import { resolveAffiliate } from "@/lib/affiliate";

export function GET(_req, { params }) {
  const slug = params?.slug || "";
  const url = resolveAffiliate(slug);
  return NextResponse.redirect(url, { status: 302 });
}
