// @ts-check
const { test, expect } = require("@playwright/test");

/** Runs in the "phone" project (Pixel 7) only */
test.describe("Phone layout", () => {
  for (const url of ["/players", "/transfer-roi", "/squad-value"]) {
    test(`has no sideways page scroll on ${url}`, async ({ page }) => {
      await page.goto(url);
      await page.waitForLoadState("networkidle");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }

  test("keeps the player name and the key columns of the ROI tables in view", async ({ page }) => {
    await page.goto("/transfer-roi");
    const sales = page.locator('table[aria-describedby="sales-caption"]');
    await expect(sales.getByRole("button", { name: "Joueur", exact: true })).toBeVisible();
    await expect(sales.getByRole("button", { name: "Gain", exact: true })).toBeVisible();
  });
});
