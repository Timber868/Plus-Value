/**
 * @file Tests for the DuckDB competitions reader. Uses a tiny fixture file
 * built fresh in beforeAll so the suite is hermetic and does not depend on
 * the production `market-datasets.duckdb` snapshot.
 */

const path = require("path");
const {
  SAMPLE_ROWS,
  buildFixture,
  freshFixturePath,
} = require("../../../fixtures/buildCompetitionsFixture");

const { readCompetitions, unwrapList } = require("../../../../src/etl/readers/competitionsReader");

let fixturePath;

beforeAll(async () => {
  fixturePath = freshFixturePath("reader");
  await buildFixture(fixturePath);
});

/** End-to-end read against a real (tiny) DuckDB file. */
describe("readCompetitions", () => {
  test("returns an array with the expected row count", async () => {
    const rows = await readCompetitions(fixturePath);
    expect(rows).toHaveLength(SAMPLE_ROWS.length);
  });

  // We assert key presence rather than non-null values: the BAD fixture row
  // intentionally carries `confederation: null` to exercise the skip branch
  // in the job, so strict non-null matchers would mis-fail here.
  test("each row exposes the League-shaped keys produced by the SQL", async () => {
    const rows = await readCompetitions(fixturePath);
    const expectedKeys = [
      "competitionId",
      "name",
      "country",
      "confederation",
      "sub_type",
      "competitionFormat",
    ];
    for (const row of rows) {
      for (const key of expectedKeys) {
        expect(row).toHaveProperty(key);
      }
    }
  });

  // Verifies the SQL renames produce camelCase keys, and that DuckDBListValue
  // unwrap actually fires on real data. The `unwrapList` helper is covered
  // in isolation below.
  test("returns the FR1 league with renamed keys and sub_type unwrapped", async () => {
    const rows = await readCompetitions(fixturePath);
    const fr1 = rows.find((r) => r.competitionId === "FR1");
    expect(fr1).toBeDefined();
    expect(fr1.name).toBe("Ligue 1");
    expect(fr1.country).toBe("France");
    expect(Array.isArray(fr1.sub_type)).toBe(true);
    expect(fr1.sub_type).toContain("first_tier");
  });

  // The classification used to live in the JS mapper; it now lives in the
  // SQL CASE. Exercise both branches against real fixture rows so a typo
  // in the CASE expression is caught here, not downstream.
  test("classifies cups and leagues via the SQL CASE expression", async () => {
    const rows = await readCompetitions(fixturePath);
    const cup = rows.find((r) => r.competitionId === "DFB");
    const league = rows.find((r) => r.competitionId === "FR1");
    expect(cup.competitionFormat).toBe("cup");
    expect(league.competitionFormat).toBe("league");
  });

  // Point at a path inside a directory that does not exist; DuckDB would
  // happily create a fresh `.duckdb` file at any reachable path (which would
  // then make the test fail for the wrong reason — "table not found" rather
  // than "file not found"), so we make creation itself impossible.
  test("throws when the db path is unreachable", async () => {
    const missing = path.join(__dirname, "no-such-dir", "missing.duckdb");
    await expect(readCompetitions(missing)).rejects.toBeDefined();
  });
});

/** Pure helper that normalises DuckDB LIST columns to plain JS arrays. */
describe("unwrapList", () => {
  // Identity short-circuit: cheap and required because @duckdb/node-api may
  // already hand back plain arrays for short lists in some builds.
  test("returns the value as-is when it is already an array", () => {
    const arr = ["a", "b"];
    expect(unwrapList(arr)).toBe(arr);
  });

  test("unwraps DuckDBListValue-shaped objects via .items", () => {
    expect(unwrapList({ items: ["x", "y"] })).toEqual(["x", "y"]);
  });

  test("returns [] for null", () => {
    expect(unwrapList(null)).toEqual([]);
  });

  test("returns [] for undefined", () => {
    expect(unwrapList(undefined)).toEqual([]);
  });

  // Defensive fallback: if DuckDB ever changes the wrapper shape we degrade
  // to an empty list rather than crashing downstream `.filter(Boolean)`.
  test("returns [] for an object without an items array", () => {
    expect(unwrapList({ something: "else" })).toEqual([]);
  });
});
