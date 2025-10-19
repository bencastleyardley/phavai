// Map slugs to destination URLs (include your affiliate params or UTM here)
export const AFFILIATE_LINKS: Record<string, string> = {
  "la-sportiva-prodigio-pro": "https://www.amazon.com/dp/XXXXXXXX?tag=phavai-20",
  "saucony-peregrine": "https://www.runningwarehouse.com/?aff=phavai",
  "hoka-speedgoat": "https://www.retailer.com/speedgoat?utm_source=phavai",
};

export function resolveAffiliate(slug: string) {
  return AFFILIATE_LINKS[slug] ?? "https://phavai.com/disclosures";
}
