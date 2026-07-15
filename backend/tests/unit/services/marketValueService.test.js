/**
 * @file Unit tests for the MarketValue service. `MarketValue.bulkWrite` is
 * mocked so these run without a Mongo instance; the full Mongo path is
 * exercised in tests/integration/syncMarketValues.int.test.js.
 */

jest.mock("../../../src/models/MarketValue", () => ({
  bulkWrite: jest.fn(),
}));

const MarketValue = require("../../../src/models/MarketValue");
const {
  buildUpsertOp,
  upsertMany,
  BATCH_SIZE,
} = require("../../../src/services/marketValueService");

beforeEach(() => {
  MarketValue.bulkWrite.mockReset();
});

/** Shape of a single bulkWrite operation produced by the service. */
describe("buildUpsertOp", () => {
  const baseDoc = {
    player: "player-oid",
    date: new Date("2024-08-01"),
    value: 150000000,
  };

  test("produces an updateOne with upsert:true filtered on (player, date)", () => {
    const op = buildUpsertOp(baseDoc);
    expect(op.updateOne.filter).toEqual({
      player: "player-oid",
      date: baseDoc.date,
    });
    expect(op.updateOne.upsert).toBe(true);
  });

  test("$set contains exactly value", () => {
    const op = buildUpsertOp(baseDoc);
    expect(op.updateOne.update.$set).toEqual({ value: 150000000 });
  });
});

/** Batches docs and sums upserted/modified counters from bulkWrite. */
describe("upsertMany", () => {
  function mockResult({ upsertedCount = 0, modifiedCount = 0 } = {}) {
    return { upsertedCount, modifiedCount };
  }
  function makeDocs(n) {
    return Array.from({ length: n }, (_, i) => ({
      player: "player-oid",
      date: new Date(2020, 0, i + 1),
      value: i * 1000,
    }));
  }

  test("returns zeroed totals and skips bulkWrite for an empty array", async () => {
    const stats = await upsertMany([]);
    expect(stats).toEqual({ upserted: 0, modified: 0 });
    expect(MarketValue.bulkWrite).not.toHaveBeenCalled();
  });

  test("calls bulkWrite once when docs fit in a single batch", async () => {
    MarketValue.bulkWrite.mockResolvedValueOnce(
      mockResult({ upsertedCount: 5 }),
    );
    const stats = await upsertMany(makeDocs(5));
    expect(MarketValue.bulkWrite).toHaveBeenCalledTimes(1);
    expect(stats).toEqual({ upserted: 5, modified: 0 });
  });

  test("calls bulkWrite twice when docs exceed the batch size by one", async () => {
    MarketValue.bulkWrite
      .mockResolvedValueOnce(mockResult({ upsertedCount: BATCH_SIZE }))
      .mockResolvedValueOnce(mockResult({ upsertedCount: 1 }));
    const stats = await upsertMany(makeDocs(BATCH_SIZE + 1));
    expect(MarketValue.bulkWrite).toHaveBeenCalledTimes(2);
    expect(stats.upserted).toBe(BATCH_SIZE + 1);
  });

  test("passes { ordered: false } to every bulkWrite call", async () => {
    MarketValue.bulkWrite.mockResolvedValue(mockResult());
    await upsertMany(makeDocs(3));
    expect(MarketValue.bulkWrite).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ ordered: false }),
    );
  });

  test("treats missing upsertedCount / modifiedCount as zero", async () => {
    MarketValue.bulkWrite.mockResolvedValueOnce({});
    const stats = await upsertMany(makeDocs(2));
    expect(stats).toEqual({ upserted: 0, modified: 0 });
  });

  test("propagates errors from bulkWrite", async () => {
    MarketValue.bulkWrite.mockRejectedValueOnce(new Error("boom"));
    await expect(upsertMany(makeDocs(3))).rejects.toThrow("boom");
  });
});
