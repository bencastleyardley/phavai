import React, { Suspense } from "react";
import type { Metadata } from "next";
import SearchResults from "@/components/SearchResults";
import SearchToolbar from "@/components/SearchToolbar";

type SearchPageProps = { searchParams?: { q?: string } };

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const q = (searchParams?.q ?? "").trim();
  const title = q ? `Best picks for “${q}” — Phavai` : "Search — Phavai";
  const description = q
    ? `Transparent picks for “${q}” with scores, confidence, and sources.`
    : "Search products with transparent scores, confidence, and sources.";
  return {
    title,
    description,
    openGraph: { title, description, url: q ? `/search?q=${encodeURIComponent(q)}` : "/search", siteName: "Phavai" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function SearchPage({ searchParams }: SearchPageProps) {
  const query = (searchParams?.q ?? "").trim();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Search</h1>

      <div className="mt-6">
        <form className="flex gap-2" action="/search" method="get">
          <input
            name="q"
            defaultValue={query}
            placeholder='Search a product (e.g., “best trail running shoes 2025”)'
            className="w-full rounded-xl border px-4 py-3 outline-none focus:ring-2 focus:ring-gray-300"
          />
          <button
            type="submit"
            className="rounded-xl border px-5 py-3 font-medium hover:shadow transition"
          >
            Search
          </button>
        </form>
      </div>

      <section className="mt-10 space-y-4">
        {!query && (
          <p className="text-sm text-gray-500">
            Enter a query to see top products and Phavai’s distilled score.
          </p>
        )}

        {!!query && (
          <>
            <h2 className="text-xl font-semibold">
              Results for: <span className="font-mono">{query}</span>
            </h2>

            <Suspense fallback={null}>
              <SearchToolbar />
            </Suspense>

            <Suspense fallback={<div className="text-sm text-gray-500">Loading…</div>}>
              <SearchResults query={query} />
            </Suspense>
          </>
        )}
      </section>
    </main>
  );
}
