// components/TileCard.tsx
"use client";
import Link from "next/link";

export default function TileCard({
  title,
  query,
  subtitle,
}: {
  title: string;
  query: string;   // e.g., "best budget treadmill"
  subtitle?: string;
}) {
  const href = `/search?q=${encodeURIComponent(query)}`;
  return (
    <Link
      href={href}
      className="block rounded-2xl border p-5 hover:shadow transition"
      prefetch={false}
    >
      <div className="text-lg font-semibold">{title}</div>
      {subtitle && <div className="text-sm text-gray-500 mt-1">{subtitle}</div>}
      <div className="mt-3 text-xs underline">Explore →</div>
    </Link>
  );
}
