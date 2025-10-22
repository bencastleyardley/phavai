// app/components/badges/ReviewerTierBadge.tsx
"use client";

import React from "react";

export default function ReviewerTierBadge({
  tier,
  label,
}: {
  tier: 1 | 2 | 3;
  label: string;
}) {
  const styles: Record<number, string> = {
    1: "bg-emerald-600/15 text-emerald-600 ring-1 ring-emerald-600/30",
    2: "bg-amber-600/15 text-amber-600 ring-1 ring-amber-600/30",
    3: "bg-slate-600/15 text-slate-600 ring-1 ring-slate-600/30",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${styles[tier]}`}
      title={`Tier ${tier} – ${label}`}
    >
      <span className="font-bold">T{tier}</span>
      <span className="opacity-90">{label}</span>
    </span>
  );
}
