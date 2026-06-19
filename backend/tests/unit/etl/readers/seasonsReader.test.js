/**
 * @file Tests for the DuckDB seasons reader. Reuses the standings fixture
 * (which seeds FR1 games for 2024 + 2025 and a GB1 game for 2025) so the suite
 * is hermetic and never touches the production `market-datasets.duckdb`
 * snapshot. Verifies the distinct-season extraction, competition scoping, and
 * the string row shape the sync jobs expect.
 */

const path = require("path");
const {
  buildFixture,
  freshFixturePath,
} = require("../../../fixtures/buildStandingsFixture");

const { readSeasons } = require("../../../../src/etl/readers/seasonsReader");

let fixturePath;

beforeAll(async () => {
  fixturePath = freshFixturePath("seasonsReader");
  await buildFixture(fixturePath);
});

describe("readSeasons", () => {
  test("returns the distinct seasons a competition has games for, ascending", async () => {
    const seasons = await readSeasons({
      competitionId: "FR1",
      dbPath: fixturePath,
    });
    expect(seasons).toEqual(["2024", "2025"]);
  });

  test("scopes to the requested competition", async () => {
    const seasons = await readSeasons({
      competitionId: "GB1",
      dbPath: fixturePath,
    });
    expect(seasons).toEqual(["2025"]);
  });

  test("returns season values as strings (matches the sync job input)", async () => {
    const seasons = await readSeasons({
      competitionId: "FR1",
      dbPath: fixturePath,
    });
    for (const season of seasons) {
      expect(typeof season).toBe("string");
    }
  });

  test("returns an empty array for a competition with no games", async () => {
    const seasons = await readSeasons({
      competitionId: "ZZ9",
      dbPath: fixturePath,
    });
    expect(seasons).toEqual([]);
  });

  test("rejects when the db path is unreachable", async () => {
    const missing = path.join(__dirname, "no-such-dir", "missing.duckdb");
    await expect(
      readSeasons({ competitionId: "FR1", dbPath: missing }),
    ).rejects.toBeDefined();
  });
});
