import fs from "node:fs";
import path from "node:path";

export const metadata = {
  title: "Methodology — Phavai",
  description: "Exactly how we score products: 4-bucket average and a transparent reviewer tier system."
};

type Tier = { tier: number; label: string; emoji: string; why_trusted: string; domains: string[] };
type Tiers = { vertical: string; tiers: Tier[] };

function load(vertical: string): Tiers {
  const file = path.join(process.cwd(), "data", "reviewers", `${vertical}.tiers.json`);
  return JSON.parse(fs.readFileSync(file, "utf-8")) as Tiers;
}

export default function Page() {
  const tiers = load("trail-running-shoes");
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Our Methodology</h1>
      <p className="mt-3 text-muted-foreground">
        We compute a simple average of four buckets—Published, Reddit, YouTube, Social—scored 1–5 each. No pay-to-play. Sources are labeled with reviewer-tier badges for transparency.
      </p>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Reviewer Tiers (Trail Running Shoes)</h2>
        <p className="text-sm text-muted-foreground">We maintain category-aware tiers and update them as outlets evolve.</p>
        <div className="mt-4 grid gap-4">
          {tiers.tiers.map((t) => (
            <div key={t.tier} className="rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">{t.emoji} {t.label}</div>
                <div className="text-sm text-muted-foreground">{t.why_trusted}</div>
              </div>
              <ul className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
                {t.domains.map((d) => <li key={d} className="rounded border px-2 py-1">{d}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 text-sm text-muted-foreground">
        <h3 className="text-base font-semibold text-foreground">Scoring Details</h3>
        <ul className="ml-5 list-disc space-y-1">
          <li>4 buckets (Published, Reddit, YouTube, Social), 3 links each per product.</li>
          <li>Ranking = average of the 4 bucket scores; ties break by price, freshness, then name.</li>
          <li>We update monthly and note “Sampled” dates per product.</li>
        </ul>
      </section>
    </main>
  );
}
