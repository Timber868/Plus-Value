/**
 * @file Unit tests for the ClubSeason service. `ClubSeason.bulkWrite` is mocked
 * so these run without a Mongo instance. The real path is exercised in
 * tests/integration/syncClubs.int.test.js.
 */

jest.mock("../../../src/models/ClubSeason", () => ({
  bulkWrite: jest.fn(),
}));

const ClubSeason = require("../../../src/models/ClubSeason");
const {
  buildUpsertOp,
  upsertMany,
  BATCH_SIZE,
} = require("../../../src/services/clubSeasonService");

beforeEach(() => {
  ClubSeason.bulkWrite.mockReset();
});

/** Shape of a single bulkWrite operation produced by the service. */
describe("buildUpsertOp", () => {
  const baseDoc = { club: "c1", season: "s1", points: 42, standing: 3 };

  test("produces an updateOne with upsert:true filtered by club + season", () => {
    const op = buildUpsertOp(baseDoc);
    expect(op.updateOne.filter).toEqual({ club: "c1", season: "s1" });
    expect(op.updateOne.upsert).toBe(true);
  });

  test("$set contains exactly points and standing", () => {
    const op = buildUpsertOp(baseDoc);
    expect(op.updateOne.update.$set).toEqual({ points: 42, standing: 3 });
  });

  test("never includes club / season in $set (only in the filter)", () => {
    const op = buildUpsertOp(baseDoc);
    expect(op.updateOne.update.$set).not.toHaveProperty("club");
    expect(op.updateOne.update.$set).not.toHaveProperty("season");
  });
});

/** Batches docs and sums upserted/modified counters from bulkWrite. */
describe("upsertMany", () => {
  function mockResult({ upsertedCount = 0, modifiedCount = 0 } = {}) {
    return { upsertedCount, modifiedCount };
  }
  function makeDocs(n) {
    return Array.from({ length: n }, (_, i) => ({
      club: `c${i}`,
      season: "s1",
      points: i,
      standing: i + 1,
    }));
  }

  test("returns zeroed totals and skips bulkWrite for an empty array", async () => {
    const stats = await upsertMany([]);
    expect(stats).toEqual({ upserted: 0, modified: 0 });
    expect(ClubSeason.bulkWrite).not.toHaveBeenCalled();
  });

  test("calls bulkWrite once when docs fit in a single batch", async () => {
    ClubSeason.bulkWrite.mockResolvedValueOnce(
      mockResult({ upsertedCount: 4, modifiedCount: 1 }),
    );
    const stats = await upsertMany(makeDocs(5));
    expect(ClubSeason.bulkWrite).toHaveBeenCalledTimes(1);
    expect(stats).toEqual({ upserted: 4, modified: 1 });
  });

  test("calls bulkWrite twice when docs exceed the batch size by one", async () => {
    ClubSeason.bulkWrite
      .mockResolvedValueOnce(mockResult({ upsertedCount: BATCH_SIZE }))
      .mockResolvedValueOnce(mockResult({ upsertedCount: 1 }));
    const stats = await upsertMany(makeDocs(BATCH_SIZE + 1));
    expect(ClubSeason.bulkWrite).toHaveBeenCalledTimes(2);
    expect(stats.upserted).toBe(BATCH_SIZE + 1);
  });

  test("passes { ordered: false } to every bulkWrite call", async () => {
    ClubSeason.bulkWrite.mockResolvedValue(mockResult());
    await upsertMany(makeDocs(3));
    expect(ClubSeason.bulkWrite).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ ordered: false }),
    );
  });

  test("treats missing counts as zero", async () => {
    ClubSeason.bulkWrite.mockResolvedValueOnce({});
    const stats = await upsertMany(makeDocs(2));
    expect(stats).toEqual({ upserted: 0, modified: 0 });
  });

  test("propagates errors from bulkWrite", async () => {
    ClubSeason.bulkWrite.mockRejectedValueOnce(new Error("boom"));
    await expect(upsertMany(makeDocs(3))).rejects.toThrow("boom");
  });
});
