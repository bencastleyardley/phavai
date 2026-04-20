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
