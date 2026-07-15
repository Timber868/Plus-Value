/**
 * @file Tests for the DuckDB player valuations reader. Builds a tiny fixture
 * file in beforeAll so the suite is hermetic and never touches the production
 * `market-datasets.duckdb` snapshot. Verifies the camelCase row shape the
 * market value mapper expects, the string playerId, the 'YYYY-MM-DD' date
 * rendering, and plain-number values.
 */

const path = require("path");
const {
  EXPECTED_ROWS,
  buildFixture,
  freshFixturePath,
} = require("../../../fixtures/buildValuationsFixture");

const {
  readPlayerValuations,
} = require("../../../../src/etl/readers/playerValuationsReader");

let fixturePath;

beforeAll(async () => {
  fixturePath = freshFixturePath("reader");
  await buildFixture(fixturePath);
});

describe("readPlayerValuations", () => {
  test("returns one row per valuation snapshot in the source table", async () => {
    const rows = await readPlayerValuations({ dbPath: fixturePath });
    expect(rows).toHaveLength(EXPECTED_ROWS.length);
  });

  test("returns the exact camelCase rows ordered by player id then date", async () => {
    const rows = await readPlayerValuations({ dbPath: fixturePath });
    expect(rows).toEqual(EXPECTED_ROWS);
  });

  test("returns playerId as a string and value as a plain JS number", async () => {
    const rows = await readPlayerValuations({ dbPath: fixturePath });
    for (const row of rows) {
      expect(typeof row.playerId).toBe("string");
      expect(typeof row.value).toBe("number");
    }
  });

  test("renders date as a 'YYYY-MM-DD' string", async () => {
    const rows = await readPlayerValuations({ dbPath: fixturePath });
    for (const row of rows) {
      expect(row.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test("rejects when the db path is unreachable", async () => {
    const missing = path.join(__dirname, "no-such-dir", "missing.duckdb");
    await expect(
      readPlayerValuations({ dbPath: missing }),
    ).rejects.toBeDefined();
  });
});
