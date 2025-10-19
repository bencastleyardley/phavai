// app/search/page.tsx
import React from "react";

type SearchPageProps = {
  searchParams?: { q?: string };
};

export default function SearchPage({ searchParams }: SearchPageProps) {
  const query = (searchParams?.q ?? "").trim();

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Search</h1>

      <div className="mt-6">
        <form className="flex gap-2" action="/search" method="get">
          <input
            name="q"
            defaultValue={query}
            placeholder="Search a product (e.g., 'best trail running shoes')"
            className="w-full rounded-xl border px-4 py-3 outline-none"
          />
          <button
            type="submit"
            className="rounded-xl px-5 py-3 border font-medium hover:shadow"
          >
            Search
          </button>
        </form>
      </div>

      <section className="mt-10">
        {!query && (
          <p className="text-sm text-gray-500">
            Enter a query to see top products and Phavai’s distilled score.
          </p>
        )}

        {!!query && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">
              Results for: <span className="font-mono">{query}</span>
            </h2>

            {/* TODO (Day 2): call your analyze API here and render:
                - Top picks with “Best Overall” / “Best Value”
                - BestPick Score + confidence + sources
                - Badges (price, weight, durability, etc.)
            */}
            <div className="rounded-2xl border p-6">
              <p className="text-sm text-gray-600">
                Analysis pipeline placeholder — wiring up next.
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
