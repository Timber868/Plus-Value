/**
 * @file End-to-end test for the syncSeasons job. Boots an in-memory MongoDB
 * (no Docker required) and a fixture DuckDB file so the full
 * reader → mapper → service → Mongo pipeline runs against real I/O. This is
 * the only place the season pipeline touches the database.
 */

const mongo = require("../helpers/mongoMemory");
const {
  EXPECTED_STANDINGS,
  buildFixture,
  freshFixturePath,
} = require("../fixtures/buildStandingsFixture");

const League = require("../../src/models/League");
const Season = require("../../src/models/Season");
const Club = require("../../src/models/Club");
const ClubSeason = require("../../src/models/ClubSeason");
const { run } = require("../../src/jobs/syncSeasons");

let fixturePath;

beforeAll(async () => {
  await mongo.start();
  await Promise.all([League.init(), Club.init(), Season.init(), ClubSeason.init()]);
  fixturePath = freshFixturePath("syncSeasons");
  await buildFixture(fixturePath);
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
    await expect(
      run({ season: "2025", competitionId: "FR1", dbPath: fixturePath }),
    ).rejects.toThrow(/league not found/i);
  });

  test("creates the season with the derived period, dates and league link", async () => {
    const league = await seedLeague();
    const stats = await run({
      season: "2025",
      competitionId: "FR1",
      dbPath: fixturePath,
    });

    expect(stats.period).toBe("2025/2026");

    const season = await Season.findOne({ league: league._id, period: "2025/2026" });
    expect(season).not.toBeNull();
    expect(season.startDate.toISOString()).toBe("2025-08-01T00:00:00.000Z");
    expect(season.endDate.toISOString()).toBe("2026-05-31T00:00:00.000Z");
  });

  test("upserts one club per standings row with the league country", async () => {
    await seedLeague();
    const stats = await run({
      season: "2025",
      competitionId: "FR1",
      dbPath: fixturePath,
    });

    expect(stats.clubsSynced).toBe(EXPECTED_STANDINGS.length);
    const clubs = await Club.find().lean();
    expect(clubs).toHaveLength(EXPECTED_STANDINGS.length);
    for (const club of clubs) {
      expect(club.country).toBe("France");
      expect(typeof club.clubId).toBe("string");
    }
  });

  test("writes ClubSeason rows with the correct points and standing", async () => {
    await seedLeague();
    await run({ season: "2025", competitionId: "FR1", dbPath: fixturePath });

    const season = await Season.findOne({ period: "2025/2026" });

    // Walk the expected table (already in standings order) and assert each
    // club's ClubSeason row matches the derived points and 1-indexed standing.
    for (let i = 0; i < EXPECTED_STANDINGS.length; i++) {
      const expected = EXPECTED_STANDINGS[i];
      const club = await Club.findOne({ clubId: expected.clubId });
      const cs = await ClubSeason.findOne({ club: club._id, season: season._id });
      expect(cs).not.toBeNull();
      expect(cs.points).toBe(expected.points);
      expect(cs.standing).toBe(i + 1);
    }
  });

  test("a second identical run does not duplicate any documents", async () => {
    await seedLeague();
    const first = await run({ season: "2025", competitionId: "FR1", dbPath: fixturePath });
    const second = await run({ season: "2025", competitionId: "FR1", dbPath: fixturePath });

    expect(second.clubsUpserted).toBe(0);
    expect(second.clubSeasonsUpserted).toBe(0);

    expect(await Season.countDocuments()).toBe(1);
    expect(await Club.countDocuments()).toBe(first.clubsSynced);
    expect(await ClubSeason.countDocuments()).toBe(first.clubSeasonsSynced);
  });

  // financialScore is a manually-curated field with no DuckDB source; a
  // re-sync must never wipe it.
  test("preserves a manually-set club financialScore across syncs", async () => {
    await seedLeague();
    await run({ season: "2025", competitionId: "FR1", dbPath: fixturePath });
    await Club.updateOne({ clubId: "1" }, { $set: { financialScore: 80 } });

    await run({ season: "2025", competitionId: "FR1", dbPath: fixturePath });

    const club = await Club.findOne({ clubId: "1" });
    expect(club.financialScore).toBe(80);
  });
});
