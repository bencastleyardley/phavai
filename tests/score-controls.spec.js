import { expect, test } from "@playwright/test";

test("public scoring and compliance mode stay disciplined", async ({ page }) => {
  await page.goto("/best-mens-trail-running-shoes.html");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await expect(page.locator("body")).toContainText("Sources checked Apr 20, 2026");
  await expect(page.locator("[data-decision-helper]")).toHaveCount(0);
  await expect(page.locator(".top-picks-snapshot")).toHaveCount(0);
  await expect(page.locator("[data-quick-answer]")).toBeVisible();
  await expect(page.locator("[data-quick-answer]")).toContainText("Quick answer");
  await expect(page.locator("[data-quick-answer] [data-affiliate-link]")).toContainText(/Check price|(?:Men|Women)'s at/);
  await expect(page.locator(".page-hero + .band [data-product-list]")).toBeVisible();
  await expect(page.locator(".product").first()).toHaveAttribute("data-decision-graph", /comfort/);
  await expect(page.locator(".recommended-product")).toHaveCount(0);
  await expect(page.locator("[data-score-controls]")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Custom score");
  await expect(page.locator("body")).not.toContainText("Source agreement");
  await expect(page.locator("body")).not.toContainText("Evidence depth");
  await expect(page.locator(".attribute-meter-grid")).toHaveCount(0);
  expect(await page.locator("[data-affiliate-link]").count()).toBeGreaterThan(0);
  await expect(page.locator("body")).not.toContainText("Check retailer");
  await expect(page.locator(".shopping-button--pending")).toHaveCount(0);
  await expect(page.locator(".shopping-button").first()).toContainText(/Check price|(?:Men|Women)'s at/);
  await expect(page.locator(".shopping-button").first()).toHaveAttribute("rel", /sponsored/);
  await expect(page.locator("#hoka-speedgoat-7 .source-accordion")).toHaveCount(0);
  await page.locator("#hoka-speedgoat-7 .evidence-drawer > summary").click();
  await expect(page.locator("#hoka-speedgoat-7 .evidence-drawer > summary")).toContainText("View full evidence");
  await expect(page.locator("#hoka-speedgoat-7 .evidence-drawer")).toContainText("What people like");
  await expect(page.locator("#hoka-speedgoat-7 .evidence-drawer")).toContainText("What people caution");
  await expect(page.locator("#hoka-speedgoat-7 .evidence-drawer")).toContainText("checked Apr 22, 2026");
  const quickSourceOverlap = await page.locator("#hoka-speedgoat-7").evaluate((product) => {
    const good = Array.from(product.querySelectorAll(".like-panel a")).map((link) => link.href);
    const bad = Array.from(product.querySelectorAll(".caution-panel a")).map((link) => link.href);
    return good.filter((url) => bad.includes(url));
  });
  expect(quickSourceOverlap).toEqual([]);
});

test("public pages and new review guides render complete trust sections", async ({ page }) => {
  const reviewPages = [
    "/best-womens-trail-running-shoes.html",
    "/best-running-headphones.html",
    "/best-gps-running-watches.html",
    "/best-standing-desks.html",
    "/best-office-chairs.html",
    "/best-hydration-packs.html",
    "/best-trail-running-poles.html",
    "/best-running-vests.html",
    "/best-recovery-sandals.html",
    "/best-comfortable-trail-running-shoes.html",
    "/best-ultramarathon-fuel.html",
    "/best-running-gels-for-ultramarathons.html",
    "/best-electrolyte-mixes-for-ultrarunning.html",
    "/best-webcams-for-remote-work.html",
    "/best-desk-mats.html",
    "/best-monitor-arms.html",
    "/best-ergonomic-keyboards.html",
    "/best-carry-on-luggage.html",
    "/best-coffee-makers.html",
    "/best-massage-guns.html",
    "/best-air-purifiers.html"
  ];

  for (const route of reviewPages) {
    await page.goto(route);
    await expect(page.locator('link[rel="icon"][href="/favicon.svg"]')).toHaveCount(1);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator(".product").first()).toBeVisible();
    const firstProductMedia = page.locator(".product").first().locator(".product-media");
    const apiImageCount = await firstProductMedia.locator("img").count();
    if (apiImageCount) {
      await expect(firstProductMedia.locator("img")).toBeVisible();
      await expect(firstProductMedia.locator("img")).toHaveAttribute("alt", /.+/);
    } else {
      await expect(firstProductMedia.locator(".product-visual-icon svg")).toBeVisible();
    }
    await expect(page.locator(".product").first().locator(".product-media")).toHaveText("");
    await expect(page.locator(".comparison-table")).toBeVisible();
    await expect(page.locator(".faq-list")).toBeVisible();
    await expect(page.locator(".final-panel")).toBeVisible();
    await expect(page.locator(".affiliate-disclosure")).toContainText("As an Amazon Associate I earn from qualifying purchases");
    await expect(page.locator(".source-accordion")).toHaveCount(0);
    await expect(page.locator(".product .evidence-drawer").first()).toContainText("View full evidence");
    await expect(page.locator(".product").first().locator(".decision-summary")).toBeVisible();
    await expect(page.locator(".product").first()).toHaveAttribute("data-decision-graph", /attributes/);
    await expect(page.locator(".product").first().locator(".editorial-callout")).toHaveCount(0);
    await expect(page.locator(".product").first().locator(".consensus-snapshot")).toHaveCount(0);
    await expect(page.locator(".product").first().locator(".mini-decision-grid")).toContainText("Key tradeoff");
    await expect(page.locator("[data-decision-helper]")).toHaveCount(0);
    await expect(page.locator(".top-picks-snapshot")).toHaveCount(0);
    await expect(page.locator("[data-quick-answer]")).toBeVisible();
    await expect(page.locator("[data-quick-answer] [data-affiliate-link]")).toContainText(/Check price|(?:Men|Women)'s at/);
    await expect(page.locator(".page-hero + .band [data-product-list]")).toBeVisible();
    await expect(page.locator(".product").first().locator(".product-signal").first()).toContainText(/Expert|YouTube|Reddit/);
    await expect(page.locator(".product").first().locator(".product-signal").first()).toContainText("Best evidence");
    await expect(page.locator(".product").first().locator(".product-signal").first().locator("[data-source-link]").first()).toBeVisible();
    await expect(page.locator(".product").first().locator(".evidence-drawer").first()).toContainText("View full evidence");
    await expect(page.locator(".source-table")).toHaveCount(0);
    await expect(page.locator('a[href*="youtube.com/results"], a[href*="reddit.com/search"]')).toHaveCount(0);
    await expect(page.locator("body")).toContainText("Related");
    await expect(page.locator(".buy-check")).toHaveCount(0);
    await expect(page.locator(".shopping-note")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("Opens Amazon. Compare size, flavor, color, and seller pricing before checkout.");
    await expect(page.locator("body")).not.toContainText("Check retailer");
    await expect(page.locator("body")).not.toContainText("A buyer-facing score built from eligible expert reviews");
    expect(await page.locator("[data-affiliate-link]").count()).toBeGreaterThan(0);
    await expect(page.locator(".shopping-button--pending")).toHaveCount(0);
    await expect(page.locator(".product .shopping-button").first()).toContainText(/Check price|(?:Men|Women)'s at/);
    await expect(page.locator(".product .shopping-button").first()).toHaveAttribute("rel", /sponsored/);
    await expect(page.locator(".attribute-meter-grid")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("Custom score");
    await expect(page.locator("body")).not.toContainText("Source agreement");
    await expect(page.locator("body")).not.toContainText("Evidence depth");
    await expect(page.locator('[data-weight-label="Social"]')).toHaveCount(0);
  }

  await page.goto("/best-comfortable-trail-running-shoes.html");
  await expect(page.locator(".product-signal").filter({ hasText: "YouTube" }).first()).toBeVisible();
  expect(await page.locator('a[href*="youtube.com/watch"]').count()).toBeGreaterThan(0);
  await expect(page.locator(".product").first().locator(".source-accordion")).toHaveCount(0);
  await expect(page.locator(".product").first().locator(".product-signal").first()).toContainText("Score");

  await page.goto("/best-trail-running-poles.html");
  await expect(page.locator("#black-diamond-distance-carbon-z .product-media")).toHaveClass(/product-visual--folded-race/);
  await expect(page.locator("#leki-ultratrail-fx-one-superlite .product-media")).toHaveClass(/product-visual--grip-control/);
  await expect(page.locator("#black-diamond-distance-z .product-media")).toHaveClass(/product-visual--durable-value/);
  await expect(page.locator("#gossamer-gear-lt5 .product-media")).toHaveClass(/product-visual--telescoping-adjust/);
  await expect(page.locator("#black-diamond-distance-carbon-z .product-media")).toHaveText("");
  await expect(page.locator("#leki-ultratrail-fx-one-superlite .product-media")).toHaveText("");

  for (const route of ["/outdoor.html", "/remote-work.html", "/lifestyle.html"]) {
    await page.goto(route);
    await expect(page.locator('link[rel="icon"][href="/favicon.svg"]')).toHaveCount(1);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator(".category-card").first()).toBeVisible();
    await expect(page.locator(".band#guides")).toBeVisible();
    await expect(page.locator("nav")).toContainText("Outdoor");
    await expect(page.locator("nav")).toContainText("Remote Work");
    await expect(page.locator("nav")).toContainText("Lifestyle");
  }

  for (const route of ["/about.html", "/contact.html", "/privacy.html", "/terms.html"]) {
    await page.goto(route);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("nav")).toContainText("Outdoor");
    await expect(page.locator("nav")).toContainText("Remote Work");
    await expect(page.locator("nav")).toContainText("Lifestyle");
  }

  for (const route of [
    "/editorial-standards.html",
    "/how-to-choose-trail-running-shoes.html",
    "/hydration-pack-vs-running-vest.html",
    "/how-to-build-ergonomic-home-office.html",
    "/how-to-choose-air-purifier.html"
  ]) {
    await page.goto(route);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("body")).toContainText("Phavai");
  }
});

test("mobile navigation, retired picks, and hub discovery remain clean", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const route of ["/", "/outdoor.html", "/best-mens-trail-running-shoes.html"]) {
    await page.goto(route);
    await expect(page.locator(".nav-links a").filter({ hasText: "Outdoor" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }

  await page.goto("/outdoor.html");
  await expect(page.locator("#focused-guides")).toBeVisible();
  await expect(page.locator("#shopping-advice")).toBeVisible();
  await expect(page.locator('a[href="/best-trail-shoes-for-beginners.html"]')).toBeVisible();
  await expect(page.locator('a[href="/how-to-choose-trail-running-shoes.html"]')).toBeVisible();

  const skipLink = page.locator(".skip-link");
  await skipLink.focus();
  await expect(skipLink).toBeVisible();

  await page.goto("/todays-picks.html");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex,follow");
  await expect(page.locator('a[href="/todays-picks.html"]')).toHaveCount(0);
});
