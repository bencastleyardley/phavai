const PAGES = ["", "/search", "/how-it-works", "/about", "/disclosures", "/privacy", "/terms"];

export async function GET() {
  const base = "https://phavai.com";
  const urls = PAGES.map((p) => `<url><loc>${base}${p}</loc></url>`).join("");
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml" } });
}
