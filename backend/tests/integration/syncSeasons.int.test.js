/**
 * @file End-to-end test for the syncSeasons job. Boots an in-memory MongoDB
 * (no Docker required) so the league lookup → season upsert path runs against
 * a real database. syncSeasons no longer reads DuckDB (clubs + club seasons
 * moved to syncClubs), so no fixture file is needed here.
 */

const mongo = require("../helpers/mongoMemory");

const League = require("../../src/models/League");
const Season = require("../../src/models/Season");
const { run } = require("../../src/jobs/syncSeasons");

beforeAll(async () => {
  await mongo.start();
  await Promise.all([League.init(), Season.init()]);
});

afterAll(async () => {
  await mongo.stop();
});

beforeEach(async () => {
  await mongo.clearAll();
});

/** Seeds the FR1/France league the season hangs off of. */
async function seedLeague() {
  return League.create({
    competitionId: "FR1",
    name: "Ligue 1",
    country: "France",
    confederation: "UEFA",
    competitionFormat: "league",
  });
}

describe("syncSeasons job (integration)", () => {
  test("throws when the league has not been synced yet", async () => {
    await expect(run({ season: "2025", competitionId: "FR1" })).rejects.toThrow(
      /league not found/i,
    );
  });

  test("creates the season with the derived period, dates and league link", async () => {
    const league = await seedLeague();
    const stats = await run({ season: "2025", competitionId: "FR1" });

    expect(stats.period).toBe("2025/2026");

    const season = await Season.findOne({
      league: league._id,
      period: "2025/2026",
    });
    expect(season).not.toBeNull();
    expect(season.startDate.toISOString()).toBe("2025-08-01T00:00:00.000Z");
    expect(season.endDate.toISOString()).toBe("2026-05-31T00:00:00.000Z");
  });

  test("a second identical run does not duplicate the season", async () => {
    await seedLeague();
    await run({ season: "2025", competitionId: "FR1" });
    await run({ season: "2025", competitionId: "FR1" });

    expect(await Season.countDocuments()).toBe(1);
  });
});
