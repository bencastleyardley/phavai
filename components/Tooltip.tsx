"use client";
import * as React from "react";

export default function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open && (
        <span className="absolute z-20 mt-8 w-64 rounded-lg border bg-background p-2 text-xs shadow-lg">
          {text}
        </span>
      )}
    </span>
  );
}
