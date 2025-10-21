"use client";
import Link from "next/link";

export default function TileCard({ title, query, subtitle }: { title: string; query: string; subtitle?: string; }) {
  const href = `/search?q=${encodeURIComponent(query)}`;
  return (
    <Link href={href} prefetch={false} className="block rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow">
      <div className="text-lg font-semibold">{title}</div>
      {subtitle && <div className="mt-1 text-sm text-gray-500">{subtitle}</div>}
      <div className="mt-4 text-xs underline">Explore →</div>
    </Link>
  );
}
