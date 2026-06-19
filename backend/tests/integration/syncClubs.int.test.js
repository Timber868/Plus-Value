/**
 * @file End-to-end test for the syncClubs job. Boots an in-memory MongoDB (no
 * Docker required) and a fixture DuckDB file so the full
 * reader → mapper → service → Mongo pipeline runs against real I/O. Clubs and
 * club seasons depend on the league + season already existing, so each test
 * seeds the league and runs syncSeasons first.
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
const syncSeasons = require("../../src/jobs/syncSeasons");
const { run } = require("../../src/jobs/syncClubs");

let fixturePath;

beforeAll(async () => {
  await mongo.start();
  await Promise.all([
    League.init(),
    Club.init(),
    Season.init(),
    ClubSeason.init(),
  ]);
  fixturePath = freshFixturePath("syncClubs");
  await buildFixture(fixturePath);
});

afterAll(async () => {
  await mongo.stop();
});

beforeEach(async () => {
  await mongo.clearAll();
});

/** Seeds the FR1/France league the clubs hang off of. */
async function seedLeague() {
  return League.create({
    competitionId: "FR1",
    name: "Ligue 1",
    country: "France",
    confederation: "UEFA",
    competitionFormat: "league",
  });
}

/** Seeds the league and the season so syncClubs has its prerequisites. */
async function seedLeagueAndSeason() {
  const league = await seedLeague();
  await syncSeasons.run({ season: "2025", competitionId: "FR1" });
  return league;
}

describe("syncClubs job (integration)", () => {
  test("throws when the league has not been synced yet", async () => {
    await expect(
      run({ season: "2025", competitionId: "FR1", dbPath: fixturePath }),
    ).rejects.toThrow(/league not found/i);
  });

  test("throws when the season has not been synced yet", async () => {
    await seedLeague();
    await expect(
      run({ season: "2025", competitionId: "FR1", dbPath: fixturePath }),
    ).rejects.toThrow(/season not found/i);
  });

  test("upserts one club per standings row with the league country", async () => {
    await seedLeagueAndSeason();
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
    await seedLeagueAndSeason();
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
    await seedLeagueAndSeason();
    const first = await run({
      season: "2025",
      competitionId: "FR1",
      dbPath: fixturePath,
    });
    const second = await run({
      season: "2025",
      competitionId: "FR1",
      dbPath: fixturePath,
    });

    expect(second.clubsUpserted).toBe(0);
    expect(second.clubSeasonsUpserted).toBe(0);

    expect(await Club.countDocuments()).toBe(first.clubsSynced);
    expect(await ClubSeason.countDocuments()).toBe(first.clubSeasonsSynced);
  });

  // financialScore is a manually-curated field with no DuckDB source; a
  // re-sync must never wipe it.
  test("preserves a manually-set club financialScore across syncs", async () => {
    await seedLeagueAndSeason();
    await run({ season: "2025", competitionId: "FR1", dbPath: fixturePath });
    await Club.updateOne({ clubId: "1" }, { $set: { financialScore: 80 } });

    await run({ season: "2025", competitionId: "FR1", dbPath: fixturePath });

    const club = await Club.findOne({ clubId: "1" });
    expect(club.financialScore).toBe(80);
  });
});
