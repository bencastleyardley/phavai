"use client";
import React from "react";

export default function ScoreChip({
  label,
  value,
  tone = "default",
}: { label: string; value: number; tone?: "default" | "good" | "ok" | "poor" }) {
  const background =
    tone === "good" ? "bg-green-50 dark:bg-emerald-900/30"
    : tone === "ok"   ? "bg-amber-50 dark:bg-amber-900/30"
    : tone === "poor" ? "bg-rose-50 dark:bg-rose-900/30"
    : "bg-slate-50 dark:bg-slate-900/30";

  return (
    <span className={`chip ${background}`}>
      <span className="mr-1 font-semibold">{value.toFixed(1)}</span>{label}
    </span>
  );
}
