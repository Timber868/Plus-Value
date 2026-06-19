/**
 * @file Tests for the DuckDB standings reader. Builds a tiny fixture file in
 * beforeAll so the suite is hermetic and never touches the production
 * `market-datasets.duckdb` snapshot. Verifies the points/standings derivation
 * (win=3, draw=1, loss=0), the season+competition scoping, and the camelCase
 * row shape the mappers expect.
 */

const path = require("path");
const {
  EXPECTED_STANDINGS,
  buildFixture,
  freshFixturePath,
} = require("../../../fixtures/buildStandingsFixture");

const { readStandings } = require("../../../../src/etl/readers/standingsReader");

let fixturePath;

beforeAll(async () => {
  fixturePath = freshFixturePath("reader");
  await buildFixture(fixturePath);
});

describe("readStandings", () => {
  test("returns one row per club that played in the scoped season", async () => {
    const rows = await readStandings({
      season: "2025",
      competitionId: "FR1",
      dbPath: fixturePath,
    });
    expect(rows).toHaveLength(EXPECTED_STANDINGS.length);
  });

  test("derives points and tallies exactly, ordered by points then goal diff", async () => {
    const rows = await readStandings({
      season: "2025",
      competitionId: "FR1",
      dbPath: fixturePath,
    });
    expect(rows).toEqual(EXPECTED_STANDINGS);
  });

  test("each row exposes the camelCase keys the mappers expect", async () => {
    const rows = await readStandings({
      season: "2025",
      competitionId: "FR1",
      dbPath: fixturePath,
    });
    const expectedKeys = [
      "clubId",
      "name",
      "played",
      "won",
      "drawn",
      "lost",
      "goalsFor",
      "goalsAgainst",
      "goalDiff",
      "points",
    ];
    for (const row of rows) {
      for (const key of expectedKeys) {
        expect(row).toHaveProperty(key);
      }
    }
  });

  test("returns clubId as a string (matches Club.clubId)", async () => {
    const rows = await readStandings({
      season: "2025",
      competitionId: "FR1",
      dbPath: fixturePath,
    });
    for (const row of rows) {
      expect(typeof row.clubId).toBe("string");
    }
  });

  test("counts are plain JS numbers, not BigInt", async () => {
    const [top] = await readStandings({
      season: "2025",
      competitionId: "FR1",
      dbPath: fixturePath,
    });
    expect(typeof top.points).toBe("number");
    expect(typeof top.played).toBe("number");
    expect(typeof top.goalDiff).toBe("number");
  });

  // The distractor games (season 2024, competition GB1) must not leak in: if
  // they did, Club A's tallies would balloon well past the FR1/2025 totals.
  test("excludes games from other seasons and competitions", async () => {
    const rows = await readStandings({
      season: "2025",
      competitionId: "FR1",
      dbPath: fixturePath,
    });
    const clubA = rows.find((r) => r.clubId === "1");
    expect(clubA.played).toBe(3);
    expect(clubA.goalsFor).toBe(4);
  });

  test("returns an empty array for a season with no games", async () => {
    const rows = await readStandings({
      season: "1999",
      competitionId: "FR1",
      dbPath: fixturePath,
    });
    expect(rows).toEqual([]);
  });

  test("rejects when the db path is unreachable", async () => {
    const missing = path.join(__dirname, "no-such-dir", "missing.duckdb");
    await expect(
      readStandings({ season: "2025", competitionId: "FR1", dbPath: missing }),
    ).rejects.toBeDefined();
  });
});
