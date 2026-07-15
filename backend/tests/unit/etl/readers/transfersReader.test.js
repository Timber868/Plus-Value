/**
 * @file Tests for the DuckDB transfers reader. Builds a tiny fixture file in
 * beforeAll so the suite is hermetic and never touches the production
 * `market-datasets.duckdb` snapshot. Verifies the camelCase row shape the
 * transfer mapper expects, the string club/player ids, the 'YYYY-MM-DD' date
 * rendering, and the DECIMAL fee arriving as a plain number (or null).
 */

const path = require("path");
const {
  EXPECTED_ROWS,
  buildFixture,
  freshFixturePath,
} = require("../../../fixtures/buildTransfersFixture");

const { readTransfers } = require("../../../../src/etl/readers/transfersReader");

let fixturePath;

beforeAll(async () => {
  fixturePath = freshFixturePath("reader");
  await buildFixture(fixturePath);
});

describe("readTransfers", () => {
  test("returns one row per transfer in the source table", async () => {
    const rows = await readTransfers({ dbPath: fixturePath });
    expect(rows).toHaveLength(EXPECTED_ROWS.length);
  });

  test("returns the exact camelCase rows ordered by player id then date", async () => {
    const rows = await readTransfers({ dbPath: fixturePath });
    expect(rows).toEqual(EXPECTED_ROWS);
  });

  test("returns player and club ids as strings", async () => {
    const rows = await readTransfers({ dbPath: fixturePath });
    for (const row of rows) {
      expect(typeof row.playerId).toBe("string");
      expect(typeof row.buyerClubId).toBe("string");
      expect(typeof row.sellerClubId).toBe("string");
    }
  });

  test("returns the fee as a plain JS number, or null for free transfers", async () => {
    const rows = await readTransfers({ dbPath: fixturePath });
    const paid = rows.find((r) => r.playerId === "1" && r.season === "24/25");
    const free = rows.find((r) => r.playerId === "2" && r.date === "2024-07-01");
    expect(paid.fee).toBe(180000000);
    expect(free.fee).toBeNull();
  });

  test("rejects when the db path is unreachable", async () => {
    const missing = path.join(__dirname, "no-such-dir", "missing.duckdb");
    await expect(readTransfers({ dbPath: missing })).rejects.toBeDefined();
  });
});
