"use client";
import { useRouter, useSearchParams } from "next/navigation";

export default function SearchToolbar() {
  const sp = useSearchParams();
  const router = useRouter();
  const sort = sp.get("sort") ?? "score";

  function set(key: string, val: string) {
    const s = new URLSearchParams(sp.toString());
    s.set(key, val);
    router.push(`/search?${s.toString()}`);
  }

  const btn = (active: boolean) =>
    `px-3 py-1 rounded-md border ${active ? "bg-gray-900 text-white" : "hover:bg-gray-100"}`;

  return (
    <div className="mb-4 flex items-center gap-3 text-sm">
      <span className="text-gray-600">Sort:</span>
      <button className={btn(sort === "score")} onClick={() => set("sort", "score")}>Score</button>
      <button className={btn(sort === "confidence")} onClick={() => set("sort", "confidence")}>Confidence</button>
      <button className={btn(sort === "price")} onClick={() => set("sort", "price")}>Price</button>
    </div>
  );
}
