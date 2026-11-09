// @ts-check
const { test, expect } = require("@playwright/test");

test.describe("Rentabilité des transferts", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/transfer-roi");
    await expect(page.getByRole("heading", { level: 1, name: "Rentabilité des transferts" })).toBeVisible();
  });

  test("opens on Ligue 1, Olympique Lyonnais and the latest season, with this season's sales", async ({ page }) => {
    await expect(page.getByRole("tab", { name: "Ligue 1" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("button", { name: "Club", exact: true })).toContainText("Olympique Lyonnais");
    await expect(page.getByLabel("Saison")).toHaveValue(/.+/);
    await expect(page.getByLabel("Saison").locator("option:checked")).toHaveText("2025/2026");

    const sales = page.locator('table[aria-describedby="sales-caption"]');
    await expect(sales).toContainText("Rayan Cherki");
    await expect(sales).toContainText("Manchester City");
    await expect(sales).toContainText("Formé au club");
    await expect(sales).toContainText("Lucas Perri");
    await expect(sales).toContainText("Leeds United");
    await expect(page.getByText("Aucune recrue n'est enregistrée pour Olympique Lyonnais sur cette période.")).toBeVisible();
  });

  test("shows every season's purchases, Mangala once with his purchase fee, and sorts by the amount paid", async ({ page }) => {
    await page.getByLabel("Saison").selectOption({ label: "Toutes les saisons" });
    const purchases = page.locator('table[aria-describedby="purchases-caption"]');
    await expect(purchases).toContainText("Malick Fofana");

    const mangala = purchases.locator("tbody tr", { hasText: "Orel Mangala" });
    await expect(mangala).toHaveCount(1);
    await expect(mangala).toContainText(/23\s400\s000/);

    await page.getByRole("button", { name: "Montant payé" }).click();
    await expect(purchases.locator("tbody tr").first()).toContainText("Orel Mangala");
    await expect(page.locator("th", { hasText: "Montant payé" })).toHaveAttribute("aria-sort", "descending");
  });

  test("switches to constant euros and to the detailed view", async ({ page }) => {
    const constant = page.getByRole("button", { name: /Euros constants/ });
    await constant.click();
    await expect(constant).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: /Afficher la vue détaillée/ }).click();
    await expect(page.getByRole("button", { name: "Revenir à la vue simple" })).toBeVisible();
  });

  test("picks another club from the crest dropdown", async ({ page }) => {
    await page.getByRole("button", { name: "Club", exact: true }).click();
    await page.getByRole("option", { name: /AS Monaco/ }).click();
    await expect(page.getByRole("button", { name: "Club", exact: true })).toContainText("AS Monaco");
  });

  test("explains that Ligue 2 has no clubs yet", async ({ page }) => {
    await page.getByRole("tab", { name: "Ligue 2" }).click();
    await expect(page.getByText("Aucun club n'est encore disponible pour ce championnat.", { exact: false })).toBeVisible();
  });
});
