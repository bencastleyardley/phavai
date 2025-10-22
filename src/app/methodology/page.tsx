export const metadata = {
  title: "Methodology  Phavai",
  description: "Exactly how we score products: 4-bucket average and a transparent reviewer tier system."
};

export default function Page() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Our Methodology</h1>
      <p className="mt-3 text-muted-foreground">
        We compute a simple average of four bucketsPublished, Reddit, YouTube, Socialscored 15 each.
        Sources are labeled with reviewer-tier badges for transparency.
      </p>
      <section className="mt-8 text-sm text-muted-foreground">
        <ul className="ml-5 list-disc space-y-1">
          <li>4 buckets (Published, Reddit, YouTube, Social), exactly 3 links each per product.</li>
          <li>Ranking = average of the 4 bucket scores; ties break by price, freshness, then name.</li>
          <li>Updated monthly; we show Sampled dates per product.</li>
        </ul>
      </section>
    </main>
  );
}