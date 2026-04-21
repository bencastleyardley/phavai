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

  await expect(page.locator("[data-ranking-note]")).toContainText("Phavai default");
  await expect(page.locator("body")).toContainText("Sources verified Apr 20, 2026");
  await expect(page.locator(".evidence-panel").first()).toContainText("verified Apr 20, 2026");
  const defaultTop = await page.locator(".product").first().getAttribute("data-product-name");
  const defaultScore = await page.locator("[data-bestpick]").first().innerText();

  await setSlider(page, "Expert", 100);
  await setSlider(page, "YouTube", 0);
  await setSlider(page, "Reddit", 0);

  await expect(page.locator('[data-weight-label="Expert"]')).toHaveText("100%");
  await expect(page.locator("[data-ranking-note]")).toContainText("Ranking changed");
  await expect(page.locator(".product").first()).not.toHaveAttribute("data-product-name", defaultTop ?? "");
  await expect(page.locator("[data-bestpick]").first()).not.toHaveText(defaultScore);
  await page.locator("[data-save-weights]").click();
  await expect(page.locator("[data-save-note]")).toContainText("Preference saved");

  await page.reload();
  await expect(page.locator('[data-weight-label="Expert"]')).toHaveText("100%");

  await page.locator("[data-reset-weights]").click();
  await expect(page.locator('[data-weight-label="Expert"]')).toHaveText("40%");
  await expect(page.locator('[data-weight-label="YouTube"]')).toHaveText("30%");
  await expect(page.locator('[data-weight-label="Reddit"]')).toHaveText("30%");
  await expect(page.locator('[data-weight-label="Social"]')).toHaveCount(0);
  await expect(page.locator("[data-ranking-note]")).toContainText("Phavai default");
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
    await expect(page.locator("body")).toContainText("Related");
    await expect(page.locator(".product .button").first()).toContainText("Check price");
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
