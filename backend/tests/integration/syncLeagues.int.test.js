/**
 * @file End-to-end test for the syncLeagues job. Boots an in-memory MongoDB
 * (no Docker required) and a fixture DuckDB file so the full reader → mapper
 * → service → Mongo pipeline runs against real I/O. This is the only place
 * League-related code touches the database.
 */

const mongo = require("../helpers/mongoMemory");
const {
  buildFixture,
  freshFixturePath,
} = require("../fixtures/buildCompetitionsFixture");

const League = require("../../src/models/League");
const { run } = require("../../src/jobs/syncLeagues");

let fixturePath;

beforeAll(async () => {
  await mongo.start();
  fixturePath = freshFixturePath("syncLeagues");
  await buildFixture(fixturePath);
});

afterAll(async () => {
  await mongo.stop();
});

// Clear the collection (not the whole server) between tests so each case
// starts from a known-empty state without paying restart cost.
beforeEach(async () => {
  await mongo.clearAll();
});

describe("syncLeagues job (integration)", () => {
  test("upserts all valid rows on a fresh database", async () => {
    const stats = await run({ dbPath: fixturePath });

    // BAD row is skipped (null confederation), the rest are upserted.
    expect(stats.skipped).toBeGreaterThanOrEqual(1);
    expect(stats.upserted).toBe(stats.synced);
    expect(stats.modified).toBe(0);

    const count = await League.countDocuments();
    expect(count).toBe(stats.synced);
  });

  // Mongoose's `timestamps: true` rewrites `updatedAt` on every upsert, so
  // `modifiedCount` will report nonzero even when nothing semantically
  // changed. Instead we assert the only things that actually matter to a
  // user: no new docs are inserted and total count is unchanged.
  test("a second identical run upserts nothing and does not duplicate docs", async () => {
    const first = await run({ dbPath: fixturePath });
    const second = await run({ dbPath: fixturePath });

    expect(second.upserted).toBe(0);

    const count = await League.countDocuments();
    expect(count).toBe(first.synced);
  });

  // `europeanSpots` is the canonical example of a manually-curated field
  // that must survive an automated sync. Regression here would silently
  // wipe values the editorial team set by hand.
  test("preserves a manually-set europeanSpots value across syncs", async () => {
    await run({ dbPath: fixturePath });
    await League.updateOne(
      { competitionId: "FR1" },
      { $set: { europeanSpots: 4 } },
    );

    await run({ dbPath: fixturePath });

    const fr1 = await League.findOne({ competitionId: "FR1" });
    expect(fr1.europeanSpots).toBe(4);
  });

  test("skips the BAD row missing required fields", async () => {
    const stats = await run({ dbPath: fixturePath });
    const bad = await League.findOne({ competitionId: "BAD" });
    expect(bad).toBeNull();
    expect(stats.skipped).toBeGreaterThanOrEqual(1);
  });

  test("maps competitionFormat correctly for cups vs leagues", async () => {
    await run({ dbPath: fixturePath });
    const cup = await League.findOne({ competitionId: "DFB" });
    const league = await League.findOne({ competitionId: "FR1" });
    expect(cup.competitionFormat).toBe("cup");
    expect(league.competitionFormat).toBe("league");
  });
});
