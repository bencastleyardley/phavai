"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function Nav() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");

  return (
    <header className="border-b bg-white/70 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-4">
        <Link href="/" className="font-semibold text-lg">Phavai</Link>

        <form action="/search" method="get" className="ml-auto flex w-full max-w-lg gap-2">
          <input
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder='Search (e.g., "best budget treadmill")'
            className="w-full rounded-xl border px-4 py-3 outline-none focus:ring-2 focus:ring-gray-300"
          />
          <button type="submit" className="rounded-xl border px-4 py-2 text-sm hover:shadow transition">Search</button>
        </form>

        <nav className="ml-4 hidden sm:flex gap-3 text-sm">
          <Link href="/how-it-works" className={linkCls(pathname,"/how-it-works")}>How it works</Link>
          <Link href="/about" className={linkCls(pathname,"/about")}>About</Link>
          <Link href="/disclosures" className={linkCls(pathname,"/disclosures")}>Disclosures</Link>
        </nav>
      </div>
    </header>
  );
}
function linkCls(path: string|null, href:string) {
  const active = path === href;
  return `px-2 py-1 rounded-md ${active ? "bg-gray-100" : "hover:bg-gray-50"}`;
}
