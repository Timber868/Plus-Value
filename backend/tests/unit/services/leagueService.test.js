/**
 * @file Unit tests for the League service. `League.bulkWrite` is mocked so
 * these run in milliseconds without needing a Mongo instance — every Mongo
 * touch is exercised end-to-end in tests/integration/syncLeagues.int.test.js.
 */

jest.mock("../../../src/models/League", () => ({
  bulkWrite: jest.fn(),
}));

const League = require("../../../src/models/League");
const {
  buildUpsertOp,
  upsertMany,
  BATCH_SIZE,
} = require("../../../src/services/leagueService");

beforeEach(() => {
  League.bulkWrite.mockReset();
});

/** Shape of a single bulkWrite operation produced by the service. */
describe("buildUpsertOp", () => {
  const baseDoc = {
    competitionId: "FR1",
    name: "Ligue 1",
    country: "France",
    confederation: "UEFA",
    competitionFormat: "league",
    tier: 1,
  };

  test("produces an updateOne with upsert:true and the correct filter", () => {
    const op = buildUpsertOp(baseDoc);
    expect(op.updateOne.filter).toEqual({ competitionId: "FR1" });
    expect(op.updateOne.upsert).toBe(true);
  });

  test("$set contains all mappable fields", () => {
    const op = buildUpsertOp(baseDoc);
    expect(op.updateOne.update.$set).toEqual({
      name: "Ligue 1",
      country: "France",
      confederation: "UEFA",
      competitionFormat: "league",
      tier: 1,
    });
  });

  // If we always wrote `tier`, an undefined value would overwrite a real tier
  // that was manually set in Mongo. The service must omit it instead.
  test("omits tier from $set when tier is undefined", () => {
    const op = buildUpsertOp({ ...baseDoc, tier: undefined });
    expect(op.updateOne.update.$set).not.toHaveProperty("tier");
    expect(op.updateOne.update.$set.name).toBe("Ligue 1");
  });

  // `europeanSpots` is a curated manual field. The sync must never touch it,
  // even if a caller accidentally includes it on the input doc.
  test("never sets europeanSpots (manual values must be preserved)", () => {
    const op = buildUpsertOp({ ...baseDoc, europeanSpots: 4 });
    expect(op.updateOne.update.$set).not.toHaveProperty("europeanSpots");
  });
});

/** Batches docs and sums upserted/modified counters from bulkWrite. */
describe("upsertMany", () => {
  function mockResult({ upsertedCount = 0, modifiedCount = 0 } = {}) {
    return { upsertedCount, modifiedCount };
  }

  function makeDocs(n) {
    return Array.from({ length: n }, (_, i) => ({
      competitionId: `C${i}`,
      name: `Comp ${i}`,
      country: "France",
      confederation: "UEFA",
      competitionFormat: "league",
    }));
  }

  // Empty input is common during dev (e.g. fresh DuckDB with no rows yet);
  // we must not pay for an unnecessary round trip to Mongo in that case.
  test("returns zeroed totals and skips bulkWrite for an empty array", async () => {
    const stats = await upsertMany([]);
    expect(stats).toEqual({ upserted: 0, modified: 0 });
    expect(League.bulkWrite).not.toHaveBeenCalled();
  });

  test("calls bulkWrite once when docs fit in a single batch", async () => {
    League.bulkWrite.mockResolvedValueOnce(
      mockResult({ upsertedCount: 5, modifiedCount: 0 }),
    );
    const stats = await upsertMany(makeDocs(5));
    expect(League.bulkWrite).toHaveBeenCalledTimes(1);
    expect(stats).toEqual({ upserted: 5, modified: 0 });
  });

  // Off-by-one boundary: BATCH_SIZE docs must fit in one batch, BATCH_SIZE+1
  // must spill into a second. Easiest place for a slice bug to hide.
  test("calls bulkWrite twice when docs exceed the batch size by one", async () => {
    League.bulkWrite
      .mockResolvedValueOnce(mockResult({ upsertedCount: BATCH_SIZE }))
      .mockResolvedValueOnce(mockResult({ upsertedCount: 1 }));
    const stats = await upsertMany(makeDocs(BATCH_SIZE + 1));
    expect(League.bulkWrite).toHaveBeenCalledTimes(2);
    expect(stats.upserted).toBe(BATCH_SIZE + 1);
  });

  test("calls bulkWrite three times for 3 full batches and sums totals", async () => {
    League.bulkWrite
      .mockResolvedValueOnce(mockResult({ upsertedCount: 500, modifiedCount: 0 }))
      .mockResolvedValueOnce(mockResult({ upsertedCount: 0, modifiedCount: 500 }))
      .mockResolvedValueOnce(mockResult({ upsertedCount: 100, modifiedCount: 400 }));
    const stats = await upsertMany(makeDocs(1500));
    expect(League.bulkWrite).toHaveBeenCalledTimes(3);
    expect(stats).toEqual({ upserted: 600, modified: 900 });
  });

  // `ordered: false` lets the rest of the batch succeed if one doc fails.
  // Losing this option would make a single bad row poison an entire batch.
  test("passes { ordered: false } to every bulkWrite call", async () => {
    League.bulkWrite.mockResolvedValue(mockResult());
    await upsertMany(makeDocs(3));
    expect(League.bulkWrite).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ ordered: false }),
    );
  });

  // Some Mongo server versions omit the count fields entirely when a batch
  // is a complete no-op. Coercing to 0 here prevents NaN totals.
  test("treats missing upsertedCount / modifiedCount as zero", async () => {
    League.bulkWrite.mockResolvedValueOnce({});
    const stats = await upsertMany(makeDocs(2));
    expect(stats).toEqual({ upserted: 0, modified: 0 });
  });

  // The job needs failures to surface so cron monitoring (process.exitCode=1)
  // actually triggers; swallowing errors would hide a broken sync indefinitely.
  test("propagates errors from bulkWrite", async () => {
    League.bulkWrite.mockRejectedValueOnce(new Error("boom"));
    await expect(upsertMany(makeDocs(3))).rejects.toThrow("boom");
  });
});
