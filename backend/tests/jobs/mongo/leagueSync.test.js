/**
 * Tests for src/jobs/mongo/leagueSync.js
 *
 * - Unit tests cover the pure helper functions (toCompetitionFormat, toTier,
 *   toLeagueDoc, getSkipDetail, buildUpsertOp) with happy paths, realistic
 *   DuckDB inputs, and edge cases.
 * - Integration tests exercise syncLeagues() (including { verbose: true })
 *   end-to-end with @duckdb/node-api and the League model mocked so the
 *   suite never touches MongoDB or the real DuckDB snapshot on disk.
 *
 * Fixture factories (makeRow / makeDoc) are used so individual tests only
 * declare what matters for that test, not a full object every time.
 */

jest.mock("@duckdb/node-api", () => ({
  DuckDBInstance: {
    create: jest.fn(),
  },
}));

jest.mock("../../../src/models/League", () => ({
  bulkWrite: jest.fn(),
}));

const { DuckDBInstance } = require("@duckdb/node-api");
const League = require("../../../src/models/League");
const {
  syncLeagues,
  toCompetitionFormat,
  toTier,
  toLeagueDoc,
  getSkipDetail,
  buildUpsertOp,
} = require("../../../src/jobs/mongo/leagueSync");

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

// Shape that matches what DuckDB actually returns from the competitions table.
function makeRow(overrides = {}) {
  return {
    competition_id: "FR1",
    name: "Ligue 1",
    country_name: "France",
    confederation: "UEFA",
    sub_type: ["first_tier"],
    type: "domestic_league",
    ...overrides,
  };
}

// Shape that matches a League doc (output of toLeagueDoc, input to buildUpsertOp).
function makeDoc(overrides = {}) {
  return {
    competitionId: "FR1",
    name: "Ligue 1",
    country: "France",
    confederation: "UEFA",
    competitionFormat: "league",
    tier: 1,
    ...overrides,
  };
}

// Wires up the DuckDB mock chain:
// DuckDBInstance.create() -> { connect() -> { runAndReadAll() -> { getRowObjects() } } }
function mockDuckDBRows(rows) {
  const getRowObjects = jest.fn().mockReturnValue(rows);
  const runAndReadAll = jest.fn().mockResolvedValue({ getRowObjects });
  const connect = jest.fn().mockResolvedValue({ runAndReadAll });
  DuckDBInstance.create.mockResolvedValue({ connect });
  return { getRowObjects, runAndReadAll, connect };
}

// ---------------------------------------------------------------------------
// toCompetitionFormat
// ---------------------------------------------------------------------------
describe("toCompetitionFormat", () => {
  describe("happy path", () => {
    test.each([
      ["domestic_league", "league"],
      ["domestic_cup", "cup"],
      ["international_cup", "cup"],
      ["domestic_super_cup", "cup"],
      ["other_cup", "cup"],
    ])('maps "%s" -> "%s"', (input, expected) => {
      expect(toCompetitionFormat(input)).toBe(expected);
    });
  });

  describe("edge cases", () => {
    test("is case-insensitive", () => {
      expect(toCompetitionFormat("DOMESTIC_CUP")).toBe("cup");
      expect(toCompetitionFormat("Domestic_League")).toBe("league");
    });

    test('falls back to "league" for unknown types without "cup"', () => {
      expect(toCompetitionFormat("friendly")).toBe("league");
    });

    test.each([
      ["null", null],
      ["undefined", undefined],
      ["empty string", ""],
    ])('defaults to "league" when type is %s', (_label, input) => {
      expect(toCompetitionFormat(input)).toBe("league");
    });
  });
});

// ---------------------------------------------------------------------------
// toTier
// ---------------------------------------------------------------------------
describe("toTier", () => {
  describe("happy path (array input)", () => {
    test.each([
      [["first_tier"], 1],
      [["second_tier"], 2],
      [["third_tier"], 3],
      [["fourth_tier"], 4],
      [["fifth_tier"], 5],
    ])("returns %s for %o", (input, expected) => {
      expect(toTier(input)).toBe(expected);
    });

    test("matches tier when it is a substring of a larger token", () => {
      expect(toTier(["domestic_first_tier"])).toBe(1);
    });

    test("is case-insensitive", () => {
      expect(toTier(["FIRST_TIER"])).toBe(1);
      expect(toTier(["Second_Tier"])).toBe(2);
    });

    test("returns the first matching tier when multiple are present", () => {
      expect(toTier(["first_tier", "second_tier"])).toBe(1);
    });

    test("filters out falsy values mixed with a valid tier", () => {
      expect(toTier([null, undefined, "", "first_tier"])).toBe(1);
    });
  });

  describe("edge cases (array input)", () => {
    test("returns undefined for an empty array", () => {
      expect(toTier([])).toBeUndefined();
    });

    test("returns undefined when no candidate matches a tier", () => {
      expect(toTier(["domestic_league", "uefa"])).toBeUndefined();
    });

    test("returns undefined when array only contains falsy values", () => {
      expect(toTier([null, undefined, ""])).toBeUndefined();
    });
  });

  // Regression coverage for the TypeError: subType.filter is not a function
  // crash that blew up syncLeagues on real Transfermarkt data. DuckDB can
  // return sub_type as null or a bare string, not just an array.
  describe("non-array input (real DuckDB data)", () => {
    test("returns undefined when subType is null", () => {
      expect(toTier(null)).toBeUndefined();
    });

    test("returns undefined when subType is undefined", () => {
      expect(toTier(undefined)).toBeUndefined();
    });

    test("accepts a bare string and extracts the tier", () => {
      expect(toTier("first_tier")).toBe(1);
    });

    test("returns undefined for a bare string with no tier match", () => {
      expect(toTier("uefa")).toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// toLeagueDoc
// ---------------------------------------------------------------------------
describe("toLeagueDoc", () => {
  describe("happy path", () => {
    test("maps every DuckDB column to the League schema shape", () => {
      expect(toLeagueDoc(makeRow())).toEqual({
        competitionId: "FR1",
        name: "Ligue 1",
        country: "France",
        confederation: "UEFA",
        tier: 1,
        competitionFormat: "league",
      });
    });

    test("renames country_name -> country (common source of bugs)", () => {
      const doc = toLeagueDoc(makeRow({ country_name: "England" }));
      expect(doc.country).toBe("England");
      expect(doc).not.toHaveProperty("country_name");
    });

    test("maps a cup competition with no tier info", () => {
      const doc = toLeagueDoc(makeRow({ type: "domestic_cup", sub_type: [] }));
      expect(doc.competitionFormat).toBe("cup");
      expect(doc.tier).toBeUndefined();
    });
  });

  describe("realistic DuckDB inputs", () => {
    test("handles sub_type being null (does not throw)", () => {
      expect(() =>
        toLeagueDoc(makeRow({ sub_type: null })),
      ).not.toThrow();
      expect(toLeagueDoc(makeRow({ sub_type: null })).tier).toBeUndefined();
    });

    test("handles sub_type being a single string", () => {
      expect(toLeagueDoc(makeRow({ sub_type: "first_tier" })).tier).toBe(1);
    });

    test("handles type being null (defaults to league)", () => {
      expect(
        toLeagueDoc(makeRow({ type: null })).competitionFormat,
      ).toBe("league");
    });
  });

  describe("missing fields", () => {
    test.each([
      ["competition_id", "competitionId"],
      ["name", "name"],
      ["confederation", "confederation"],
    ])(
      "propagates null %s to %s (so syncLeagues can skip it)",
      (sourceField, destField) => {
        const doc = toLeagueDoc(makeRow({ [sourceField]: null }));
        expect(doc[destField]).toBeNull();
      },
    );

    test("propagates null country_name to country (sync can still run)", () => {
      expect(
        toLeagueDoc(makeRow({ country_name: null })).country,
      ).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// getSkipDetail
// ---------------------------------------------------------------------------
describe("getSkipDetail", () => {
  test("returns null for a valid row", () => {
    expect(getSkipDetail(makeRow())).toBeNull();
  });

  test("returns missing field names and identifiers for an invalid row", () => {
    expect(
      getSkipDetail(
        makeRow({ competition_id: "Z1", name: "Z", confederation: null }),
      ),
    ).toEqual({
      competitionId: "Z1",
      name: "Z",
      missingFields: ["confederation"],
    });
  });
});

// ---------------------------------------------------------------------------
// buildUpsertOp
// ---------------------------------------------------------------------------
describe("buildUpsertOp", () => {
  describe("structure", () => {
    test("builds an updateOne operation with upsert: true", () => {
      const op = buildUpsertOp(makeDoc());
      expect(op).toHaveProperty("updateOne");
      expect(op.updateOne.upsert).toBe(true);
    });

    test("filters by competitionId", () => {
      const op = buildUpsertOp(makeDoc());
      expect(op.updateOne.filter).toEqual({ competitionId: "FR1" });
    });

    test("uses $set (not $replaceRoot) to preserve manual fields in DB", () => {
      const op = buildUpsertOp(makeDoc());
      expect(op.updateOne.update).toHaveProperty("$set");
    });
  });

  describe("fields set", () => {
    test("sets exactly the expected fields when tier is present", () => {
      const op = buildUpsertOp(makeDoc());
      expect(Object.keys(op.updateOne.update.$set).sort()).toEqual([
        "competitionFormat",
        "confederation",
        "country",
        "name",
        "tier",
      ]);
    });

    test("omits tier from $set when undefined", () => {
      const op = buildUpsertOp(makeDoc({ tier: undefined }));
      expect(op.updateOne.update.$set).not.toHaveProperty("tier");
    });

    test("omits country from $set when null or empty (int'l comps with no host country)", () => {
      const op = buildUpsertOp(makeDoc({ country: null }));
      expect(op.updateOne.update.$set).not.toHaveProperty("country");
      const op2 = buildUpsertOp(makeDoc({ country: "" }));
      expect(op2.updateOne.update.$set).not.toHaveProperty("country");
    });

    test("never includes europeanSpots — manual field is preserved across syncs", () => {
      const op = buildUpsertOp(makeDoc({ europeanSpots: 4 }));
      expect(op.updateOne.update.$set).not.toHaveProperty("europeanSpots");
    });

    test("never includes competitionId in $set (only in filter)", () => {
      const op = buildUpsertOp(makeDoc());
      expect(op.updateOne.update.$set).not.toHaveProperty("competitionId");
    });
  });
});

// ---------------------------------------------------------------------------
// syncLeagues (integration — DuckDB + Mongo mocked)
// ---------------------------------------------------------------------------
describe("syncLeagues", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("happy path", () => {
    test("transforms DuckDB rows and upserts them into MongoDB", async () => {
      mockDuckDBRows([
        makeRow({ competition_id: "FR1", name: "Ligue 1" }),
        makeRow({
          competition_id: "GB1",
          name: "Premier League",
          country_name: "England",
        }),
      ]);
      League.bulkWrite.mockResolvedValue({
        upsertedCount: 2,
        modifiedCount: 0,
      });

      const stats = await syncLeagues();

      expect(stats).toEqual({
        inspected: 2,
        skipped: 0,
        synced: 2,
        upserted: 2,
        modified: 0,
      });

      expect(League.bulkWrite).toHaveBeenCalledTimes(1);
      const [ops, options] = League.bulkWrite.mock.calls[0];
      expect(ops).toHaveLength(2);
      expect(options).toEqual({ ordered: false });
      expect(ops[0].updateOne.filter).toEqual({ competitionId: "FR1" });
      expect(ops[1].updateOne.filter).toEqual({ competitionId: "GB1" });
    });

    test("reports modified count when existing rows are updated", async () => {
      mockDuckDBRows([makeRow()]);
      League.bulkWrite.mockResolvedValue({
        upsertedCount: 0,
        modifiedCount: 1,
      });

      const stats = await syncLeagues();

      expect(stats.upserted).toBe(0);
      expect(stats.modified).toBe(1);
    });
  });

  describe("realistic Transfermarkt data", () => {
    // Regression test for the TypeError that crashed the sync in production.
    // Real rows have sub_type as null, a string, or an array — all at once.
    test("handles mixed sub_type shapes (null, string, array) without crashing", async () => {
      mockDuckDBRows([
        makeRow({ competition_id: "FR1", sub_type: ["first_tier"] }),
        makeRow({ competition_id: "C1", sub_type: null, type: "domestic_cup" }),
        makeRow({ competition_id: "FR2", sub_type: "second_tier" }),
        makeRow({ competition_id: "UEFA", sub_type: [], type: "international_cup" }),
      ]);
      League.bulkWrite.mockResolvedValue({
        upsertedCount: 4,
        modifiedCount: 0,
      });

      const stats = await syncLeagues();

      expect(stats.inspected).toBe(4);
      expect(stats.skipped).toBe(0);
      expect(stats.synced).toBe(4);

      const ops = League.bulkWrite.mock.calls[0][0];
      expect(ops[0].updateOne.update.$set.tier).toBe(1);
      expect(ops[1].updateOne.update.$set).not.toHaveProperty("tier");
      expect(ops[1].updateOne.update.$set.competitionFormat).toBe("cup");
      expect(ops[2].updateOne.update.$set.tier).toBe(2);
      expect(ops[3].updateOne.update.$set).not.toHaveProperty("tier");
    });
  });

  describe("filtering invalid rows", () => {
    test.each([
      ["competition_id", "competition_id"],
      ["name", "name"],
      ["confederation", "confederation"],
    ])("skips rows missing %s", async (field) => {
      mockDuckDBRows([
        makeRow({ competition_id: "FR1" }),
        makeRow({ competition_id: "BAD", [field]: null }),
      ]);
      League.bulkWrite.mockResolvedValue({
        upsertedCount: 1,
        modifiedCount: 0,
      });

      const stats = await syncLeagues();

      expect(stats.inspected).toBe(2);
      expect(stats.skipped).toBe(1);
      expect(stats.synced).toBe(1);
      expect(League.bulkWrite.mock.calls[0][0]).toHaveLength(1);
    });

    test("syncs row with null country (international / supranational competition)", async () => {
      mockDuckDBRows([
        makeRow({ competition_id: "ELQ", name: "Europa Q", country_name: null }),
      ]);
      League.bulkWrite.mockResolvedValue({
        upsertedCount: 1,
        modifiedCount: 0,
      });

      const stats = await syncLeagues();

      expect(stats.skipped).toBe(0);
      expect(stats.synced).toBe(1);
      const [op] = League.bulkWrite.mock.calls[0][0];
      expect(op.updateOne.update.$set).not.toHaveProperty("country");
    });

    test("counts multiple skipped rows correctly", async () => {
      mockDuckDBRows([
        makeRow({ competition_id: "FR1" }),
        makeRow({ competition_id: null }),
        makeRow({ name: null }),
        makeRow({ country_name: null }),
      ]);
      League.bulkWrite.mockResolvedValue({
        upsertedCount: 2,
        modifiedCount: 0,
      });

      const stats = await syncLeagues();

      expect(stats.inspected).toBe(4);
      expect(stats.skipped).toBe(2);
      expect(stats.synced).toBe(2);
    });

    test("with verbose, includes skippedDetails for each invalid row", async () => {
      mockDuckDBRows([
        makeRow({ competition_id: "FR1" }),
        makeRow({ competition_id: "X1", name: "Bad", confederation: null }),
        makeRow({ competition_id: null, name: "No id" }),
      ]);
      League.bulkWrite.mockResolvedValue({
        upsertedCount: 1,
        modifiedCount: 0,
      });

      const stats = await syncLeagues({ verbose: true });

      expect(stats.skipped).toBe(2);
      expect(stats).toHaveProperty("skippedDetails");
      expect(stats.skippedDetails).toEqual([
        {
          competitionId: "X1",
          name: "Bad",
          missingFields: ["confederation"],
        },
        {
          competitionId: null,
          name: "No id",
          missingFields: ["competitionId"],
        },
      ]);
    });
  });

  describe("edge cases", () => {
    test("does not call bulkWrite when there are no valid rows", async () => {
      mockDuckDBRows([]);

      const stats = await syncLeagues();

      expect(stats).toEqual({
        inspected: 0,
        skipped: 0,
        synced: 0,
        upserted: 0,
        modified: 0,
      });
      expect(League.bulkWrite).not.toHaveBeenCalled();
    });

    test("does not call bulkWrite when every row is invalid", async () => {
      mockDuckDBRows([
        makeRow({ competition_id: null }),
        makeRow({ name: null }),
      ]);

      const stats = await syncLeagues();

      expect(stats.skipped).toBe(2);
      expect(stats.synced).toBe(0);
      expect(League.bulkWrite).not.toHaveBeenCalled();
    });
  });

  describe("batching", () => {
    test("aggregates counts across multiple batches (BATCH_SIZE = 500)", async () => {
      const rows = Array.from({ length: 501 }, (_, i) =>
        makeRow({ competition_id: `C${i}`, name: `Comp ${i}`, sub_type: [] }),
      );
      mockDuckDBRows(rows);

      League.bulkWrite
        .mockResolvedValueOnce({ upsertedCount: 500, modifiedCount: 0 })
        .mockResolvedValueOnce({ upsertedCount: 1, modifiedCount: 0 });

      const stats = await syncLeagues();

      expect(League.bulkWrite).toHaveBeenCalledTimes(2);
      expect(League.bulkWrite.mock.calls[0][0]).toHaveLength(500);
      expect(League.bulkWrite.mock.calls[1][0]).toHaveLength(1);
      expect(stats.upserted).toBe(501);
      expect(stats.synced).toBe(501);
    });

    test("sends a single batch for inputs below BATCH_SIZE", async () => {
      const rows = Array.from({ length: 50 }, (_, i) =>
        makeRow({ competition_id: `C${i}` }),
      );
      mockDuckDBRows(rows);
      League.bulkWrite.mockResolvedValue({
        upsertedCount: 50,
        modifiedCount: 0,
      });

      await syncLeagues();

      expect(League.bulkWrite).toHaveBeenCalledTimes(1);
      expect(League.bulkWrite.mock.calls[0][0]).toHaveLength(50);
    });
  });

  describe("error propagation", () => {
    test("propagates errors from the DuckDB reader", async () => {
      DuckDBInstance.create.mockRejectedValue(new Error("duckdb unavailable"));

      await expect(syncLeagues()).rejects.toThrow("duckdb unavailable");
      expect(League.bulkWrite).not.toHaveBeenCalled();
    });

    test("propagates errors from MongoDB bulkWrite", async () => {
      mockDuckDBRows([makeRow()]);
      League.bulkWrite.mockRejectedValue(new Error("mongo down"));

      await expect(syncLeagues()).rejects.toThrow("mongo down");
    });

    test("stops on the first failing batch (does not call subsequent batches)", async () => {
      const rows = Array.from({ length: 501 }, (_, i) =>
        makeRow({ competition_id: `C${i}` }),
      );
      mockDuckDBRows(rows);

      League.bulkWrite.mockRejectedValueOnce(new Error("batch 1 failed"));

      await expect(syncLeagues()).rejects.toThrow("batch 1 failed");
      expect(League.bulkWrite).toHaveBeenCalledTimes(1);
    });
  });
});
