// @ts-check
const { test, expect } = require("@playwright/test");

test.describe("Valeur de l’effectif", () => {
  test("shows Lyon’s current squad with its total value and leaves out the players it sold", async ({ page }) => {
    await page.goto("/squad-value");
    await expect(page.getByRole("heading", { level: 1, name: "Valeur de l’effectif" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Valeur totale" })).toBeVisible();

    const squad = page.locator("table").first();
    await expect(squad).toContainText("Malick Fofana");
    await expect(squad).toContainText("Orel Mangala");
    await expect(squad).not.toContainText("Rayan Cherki");
    await expect(squad).not.toContainText("Lucas Perri");
  });
});

test.describe("Joueurs", () => {
  test("finds a player and opens his page with his transfers", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/players$/);
    await page.getByLabel("Nom du joueur").fill("Laca");
    await page.getByRole("link", { name: /Alexandre Lacazette/ }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Alexandre Lacazette" })).toBeVisible();
    await expect(page.getByText("Arsenal FC").first()).toBeVisible();
    await expect(page.getByText(/53\s000\s000/).first()).toBeVisible();
  });

  test("says when a player does not exist", async ({ page }) => {
    await page.goto("/players/000000000000000000000000");
    await expect(page.getByRole("heading", { level: 1, name: "Joueur introuvable" })).toBeVisible();
  });
});

test.describe("Navigation", () => {
  test("moves between the three dashboards from the header", async ({ page }) => {
    await page.goto("/players");
    await page.getByRole("link", { name: "Rentabilité des transferts" }).click();
    await expect(page).toHaveURL(/\/transfer-roi$/);
    await expect(page).toHaveTitle(/Rentabilité des transferts/);
    await page.getByRole("link", { name: /Valeur de l’effectif/ }).click();
    await expect(page).toHaveURL(/\/squad-value$/);
  });

  test("logs no errors in the browser console on any page", async ({ page }) => {
    const errors = [];
    page.on("console", (msg) => msg.type() === "error" && errors.push(msg.text()));
    page.on("pageerror", (err) => errors.push(err.message));
    for (const url of ["/players", "/transfer-roi", "/squad-value"]) {
      await page.goto(url);
      await page.waitForLoadState("networkidle");
    }
    expect(errors).toEqual([]);
  });
});
