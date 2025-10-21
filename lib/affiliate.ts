import affiliates from "@/data/affiliates.json";
export function resolveAffiliate(slug: string) {
  return (affiliates as Record<string, string>)[slug] ?? "https://phavai.com/disclosures";
}
