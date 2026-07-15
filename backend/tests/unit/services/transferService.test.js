/**
 * @file Unit tests for the Transfer service. `Transfer.bulkWrite` is mocked
 * so these run without a Mongo instance; the full Mongo path is exercised in
 * tests/integration/syncTransfers.int.test.js.
 */

jest.mock("../../../src/models/Transfer", () => ({
  bulkWrite: jest.fn(),
}));

const Transfer = require("../../../src/models/Transfer");
const {
  buildUpsertOp,
  upsertMany,
  BATCH_SIZE,
} = require("../../../src/services/transferService");

beforeEach(() => {
  Transfer.bulkWrite.mockReset();
});

/** Shape of a single bulkWrite operation produced by the service. */
describe("buildUpsertOp", () => {
  const baseDoc = {
    player: "player-oid",
    buyer: "buyer-oid",
    seller: "seller-oid",
    season: "season-oid",
    date: new Date("2024-08-15"),
    price: 180000000,
    window: "summer",
  };

  test("produces an updateOne with upsert:true filtered on (player, date, buyer)", () => {
    const op = buildUpsertOp(baseDoc);
    expect(op.updateOne.filter).toEqual({
      player: "player-oid",
      date: baseDoc.date,
      buyer: "buyer-oid",
    });
    expect(op.updateOne.upsert).toBe(true);
  });

  test("$set contains season, seller, price and window", () => {
    const op = buildUpsertOp(baseDoc);
    expect(op.updateOne.update.$set).toEqual({
      season: "season-oid",
      seller: "seller-oid",
      price: 180000000,
      window: "summer",
    });
  });

  test("omits seller, price and window from $set when absent", () => {
    const op = buildUpsertOp({
      player: "player-oid",
      buyer: "buyer-oid",
      seller: undefined,
      season: "season-oid",
      date: baseDoc.date,
      price: undefined,
      window: undefined,
    });
    expect(op.updateOne.update.$set).toEqual({ season: "season-oid" });
  });

  test("keeps a zero price in $set (free-but-recorded fee)", () => {
    const op = buildUpsertOp({ ...baseDoc, price: 0 });
    expect(op.updateOne.update.$set.price).toBe(0);
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
      buyer: "buyer-oid",
      season: "season-oid",
      date: new Date(2020, 0, i + 1),
      price: i * 1000,
      window: "winter",
    }));
  }

  test("returns zeroed totals and skips bulkWrite for an empty array", async () => {
    const stats = await upsertMany([]);
    expect(stats).toEqual({ upserted: 0, modified: 0 });
    expect(Transfer.bulkWrite).not.toHaveBeenCalled();
  });

  test("calls bulkWrite once when docs fit in a single batch", async () => {
    Transfer.bulkWrite.mockResolvedValueOnce(mockResult({ upsertedCount: 5 }));
    const stats = await upsertMany(makeDocs(5));
    expect(Transfer.bulkWrite).toHaveBeenCalledTimes(1);
    expect(stats).toEqual({ upserted: 5, modified: 0 });
  });

  test("calls bulkWrite twice when docs exceed the batch size by one", async () => {
    Transfer.bulkWrite
      .mockResolvedValueOnce(mockResult({ upsertedCount: BATCH_SIZE }))
      .mockResolvedValueOnce(mockResult({ upsertedCount: 1 }));
    const stats = await upsertMany(makeDocs(BATCH_SIZE + 1));
    expect(Transfer.bulkWrite).toHaveBeenCalledTimes(2);
    expect(stats.upserted).toBe(BATCH_SIZE + 1);
  });

  test("passes { ordered: false } to every bulkWrite call", async () => {
    Transfer.bulkWrite.mockResolvedValue(mockResult());
    await upsertMany(makeDocs(3));
    expect(Transfer.bulkWrite).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ ordered: false }),
    );
  });

  test("treats missing upsertedCount / modifiedCount as zero", async () => {
    Transfer.bulkWrite.mockResolvedValueOnce({});
    const stats = await upsertMany(makeDocs(2));
    expect(stats).toEqual({ upserted: 0, modified: 0 });
  });

  test("propagates errors from bulkWrite", async () => {
    Transfer.bulkWrite.mockRejectedValueOnce(new Error("boom"));
    await expect(upsertMany(makeDocs(3))).rejects.toThrow("boom");
  });
});
