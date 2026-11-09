// @ts-check
const { test, expect } = require("@playwright/test");

/** The real API on the demo data: the contracts the pages rely on */
test.describe("API", () => {
  test("answers the health check", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
  });

  test("lists the leagues with readable names and only Ligue 1 clubs under FR1", async ({ request }) => {
    const leagues = await (await request.get("/api/leagues")).json();
    expect(leagues.leagues).toContainEqual(expect.objectContaining({ id: "FR1", name: "Ligue 1" }));

    const { clubs } = await (await request.get("/api/clubs?league=FR1")).json();
    expect(clubs.map((c) => c.name)).toEqual(["AS Monaco", "Olympique Lyonnais", "Paris Saint-Germain"]);
  });

  test("returns an empty club list for a league without data", async ({ request }) => {
    const { clubs } = await (await request.get("/api/clubs?league=FR2")).json();
    expect(clubs).toEqual([]);
  });

  test("folds Mangala's loan into his purchase and reads Cherki as homegrown", async ({ request }) => {
    const { clubs } = await (await request.get("/api/clubs?league=FR1")).json();
    const lyon = clubs.find((c) => c.name === "Olympique Lyonnais");
    const roi = await (await request.get(`/api/clubs/${lyon.id}/transfers/roi`)).json();

    const mangala = roi.transfers.filter((t) => t.player.name === "Orel Mangala");
    expect(mangala).toHaveLength(1);
    expect(mangala[0]).toMatchObject({ feePaid: 17500000, isLoan: false });

    const cherki = roi.sales.find((s) => s.player.name === "Rayan Cherki");
    expect(cherki).toMatchObject({ homegrown: true, sellerCost: 0, gain: 36500000, toClub: { name: "Manchester City" } });

    const perri = roi.sales.find((s) => s.player.name === "Lucas Perri");
    expect(perri).toMatchObject({ sellerCost: 3250000, gain: 12350000 });
  });

  test("answers 404 for an unknown route under /api", async ({ request }) => {
    const res = await request.get("/api/does-not-exist");
    expect(res.status()).toBe(404);
  });
});
