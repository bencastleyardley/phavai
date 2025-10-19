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
    <Link href={href} className="block card p-6" prefetch={false}>
      <div className="text-lg font-semibold">{title}</div>
      {subtitle && <div className="mt-1 text-sm text-gray-500">{subtitle}</div>}
      <div className="mt-4 text-xs underline">Explore →</div>
    </Link>
  );
}
