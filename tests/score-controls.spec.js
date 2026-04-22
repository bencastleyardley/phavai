import { expect, test } from "@playwright/test";

async function setSlider(page, channel, value) {
  await page.locator(`[data-weight-input="${channel}"]`).evaluate(
    (input, nextValue) => {
      input.value = String(nextValue);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    },
    value
  );
}

test("score controls recalculate, explain rank changes, and persist weights", async ({ page }) => {
  await page.goto("/best-mens-trail-running-shoes.html");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await expect(page.locator("[data-ranking-note]")).toContainText("Phavai editorial default");
  await expect(page.locator("body")).toContainText("Sources checked Apr 20, 2026");
  await page.locator("#hoka-speedgoat-7 .source-accordion > summary").click();
  await expect(page.locator("#hoka-speedgoat-7 .source-accordion")).toContainText("What people like");
  await expect(page.locator("#hoka-speedgoat-7 .source-accordion")).toContainText("What people caution");
  await expect(page.locator("#hoka-speedgoat-7 .source-accordion")).toContainText("checked Apr 22, 2026");
  await expect(page.locator("#hoka-speedgoat-7 .quick-source-actions").first()).toContainText("Good");
  await expect(page.locator("#hoka-speedgoat-7 .quick-source-actions").first()).toContainText("Bad");
  const quickSourceOverlap = await page.locator("#hoka-speedgoat-7").evaluate((product) => {
    const good = Array.from(product.querySelectorAll(".quick-source-drop:not(.caution) a")).map((link) => link.href);
    const bad = Array.from(product.querySelectorAll(".quick-source-drop.caution a")).map((link) => link.href);
    return good.filter((url) => bad.includes(url));
  });
  expect(quickSourceOverlap).toEqual([]);
  const defaultScore = await page.locator("[data-bestpick]").first().innerText();

  await setSlider(page, "Expert", 0);
  await setSlider(page, "YouTube", 0);
  await setSlider(page, "Reddit", 100);

  await expect(page.locator('[data-weight-label="Reddit"]')).toHaveText("100%");
  await expect(page.locator("[data-bestpick]").first()).not.toHaveText(defaultScore);
  await page.locator("[data-save-weights]").click();
  await expect(page.locator("[data-save-note]")).toContainText("Preference saved");

  await page.reload();
  await expect(page.locator('[data-weight-label="Reddit"]')).toHaveText("100%");

  await page.locator("[data-reset-weights]").click();
  await expect(page.locator('[data-weight-label="Expert"]')).toHaveText("40%");
  await expect(page.locator('[data-weight-label="YouTube"]')).toHaveText("30%");
  await expect(page.locator('[data-weight-label="Reddit"]')).toHaveText("30%");
  await expect(page.locator('[data-weight-label="Social"]')).toHaveCount(0);
  await expect(page.locator("[data-ranking-note]")).toContainText("Phavai editorial default");
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
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator(".product").first()).toBeVisible();
    await expect(page.locator(".comparison-table")).toBeVisible();
    await expect(page.locator(".faq-list")).toBeVisible();
    await expect(page.locator(".final-panel")).toBeVisible();
    await expect(page.locator(".affiliate-disclosure")).toContainText("As an Amazon Associate");
    await expect(page.locator(".source-accordion").first()).toContainText("View sources");
    await expect(page.locator(".source-accordion").first()).toContainText("Expert");
    await expect(page.locator(".source-accordion").first()).toContainText("YouTube");
    await expect(page.locator(".source-accordion").first()).toContainText("Reddit");
    await expect(page.locator(".source-accordion").first()).toContainText("What people like");
    const quickSourceCount = await page.locator(".quick-source-actions").count();
    if (quickSourceCount > 0) {
      await expect(page.locator(".quick-source-actions").first()).toContainText("Good");
    }
    await expect(page.locator('a[href*="youtube.com/results"], a[href*="reddit.com/search"]')).toHaveCount(0);
    await expect(page.locator("body")).toContainText("Related");
    await expect(page.locator(".buy-check")).toHaveCount(0);
    await expect(page.locator(".product .shopping-button").first()).toContainText("Check Amazon price");
    await expect(page.locator('.product .shopping-button[href*="tag=phavai7311-20"]').first()).toBeVisible();
    await expect(page.locator(".button.disabled")).toHaveCount(0);
    await expect(page.locator('[data-weight-label="Social"]')).toHaveCount(0);
  }

  for (const route of ["/outdoor.html", "/remote-work.html", "/lifestyle.html"]) {
    await page.goto(route);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator(".category-card").first()).toBeVisible();
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
