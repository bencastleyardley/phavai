export default function HowItWorksPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold">How Phavai Works</h1>
      <ol className="mt-6 space-y-4 list-decimal pl-5 leading-7 text-gray-800">
        <li><strong>Aggregate signals.</strong> We collect public opinions from sources such as forums, videos, and professional reviews.</li>
        <li><strong>Normalize & weight.</strong> We adjust for recency, volume, and source reliability to reduce noise.</li>
        <li><strong>Score with confidence.</strong> A 0–100 score plus a confidence % explains certainty.</li>
        <li><strong>Show our work.</strong> Each pick shows a source mix and key highlights.</li>
      </ol>
      <p className="mt-6 text-sm text-gray-600">
        Scores are synthesized estimates for research. Always verify details before purchasing.
      </p>
    </main>
  );
}
