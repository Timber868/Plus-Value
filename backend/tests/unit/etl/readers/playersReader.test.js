/**
 * @file Tests for the DuckDB players reader. Builds a tiny fixture file in
 * beforeAll so the suite is hermetic and never touches the production
 * `market-datasets.duckdb` snapshot. Verifies the camelCase row shape the
 * player mapper expects, the string playerId, and the 'YYYY-MM-DD' birthDate
 * rendering (with NULLs passed through untouched).
 */

const path = require("path");
const {
  EXPECTED_ROWS,
  buildFixture,
  freshFixturePath,
} = require("../../../fixtures/buildPlayersFixture");

const { readPlayers } = require("../../../../src/etl/readers/playersReader");

let fixturePath;

beforeAll(async () => {
  fixturePath = freshFixturePath("reader");
  await buildFixture(fixturePath);
});

describe("readPlayers", () => {
  test("returns one row per player in the source table", async () => {
    const rows = await readPlayers({ dbPath: fixturePath });
    expect(rows).toHaveLength(EXPECTED_ROWS.length);
  });

  test("returns the exact camelCase rows ordered by player id", async () => {
    const rows = await readPlayers({ dbPath: fixturePath });
    expect(rows).toEqual(EXPECTED_ROWS);
  });

  test("returns playerId as a string (matches Player.playerId)", async () => {
    const rows = await readPlayers({ dbPath: fixturePath });
    for (const row of rows) {
      expect(typeof row.playerId).toBe("string");
    }
  });

  test("renders birthDate as a 'YYYY-MM-DD' string, or null when absent", async () => {
    const rows = await readPlayers({ dbPath: fixturePath });
    const withDob = rows.find((r) => r.playerId === "1");
    const withoutDob = rows.find((r) => r.playerId === "3");
    expect(withDob.birthDate).toBe("1998-12-20");
    expect(withoutDob.birthDate).toBeNull();
  });

  test("rejects when the db path is unreachable", async () => {
    const missing = path.join(__dirname, "no-such-dir", "missing.duckdb");
    await expect(readPlayers({ dbPath: missing })).rejects.toBeDefined();
  });
});
