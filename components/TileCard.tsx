import React from "react";

interface TileCardProps {
  query: string;
  title: string;
  subtitle?: string;
}

export default function TileCard({ query, title, subtitle }: TileCardProps) {
  const href = `/search?q=${encodeURIComponent(query)}`;
  return (
    <a
      href={href}
      className="block rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md"
    >
      <div className="text-lg font-semibold">{title}</div>
      {subtitle && <div className="mt-1 text-sm text-gray-500">{subtitle}</div>}
      <div className="mt-4 text-xs underline">Explore →</div>
    </a>
  );
}
