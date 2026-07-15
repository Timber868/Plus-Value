/**
 * @file Unit tests for the Club service. `Club.bulkWrite` and `Club.find` are
 * mocked so these run without a Mongo instance; the full Mongo path is
 * exercised in tests/integration/syncClubs.int.test.js.
 */

jest.mock("../../../src/models/Club", () => ({
  bulkWrite: jest.fn(),
  find: jest.fn(),
}));

const Club = require("../../../src/models/Club");
const {
  buildUpsertOp,
  buildExternalUpsertOp,
  upsertMany,
  upsertExternalMany,
  findIdsByClubId,
  BATCH_SIZE,
} = require("../../../src/services/clubService");

beforeEach(() => {
  Club.bulkWrite.mockReset();
  Club.find.mockReset();
});

/** Shape of a single bulkWrite operation produced by the service. */
describe("buildUpsertOp", () => {
  const baseDoc = { clubId: "10004", name: "Paris FC", country: "France" };

  test("produces an updateOne with upsert:true and a clubId filter", () => {
    const op = buildUpsertOp(baseDoc);
    expect(op.updateOne.filter).toEqual({ clubId: "10004" });
    expect(op.updateOne.upsert).toBe(true);
  });

  test("$set contains exactly name and country", () => {
    const op = buildUpsertOp(baseDoc);
    expect(op.updateOne.update.$set).toEqual({
      name: "Paris FC",
      country: "France",
    });
  });

  test("never includes clubId in $set (only in the filter)", () => {
    const op = buildUpsertOp(baseDoc);
    expect(op.updateOne.update.$set).not.toHaveProperty("clubId");
  });

  // financialScore / lastUpdatedScore / creationDate are manually curated;
  // the sync must never overwrite them even if a caller leaks them onto the doc.
  test("never sets manual fields (financialScore, lastUpdatedScore, creationDate)", () => {
    const op = buildUpsertOp({
      ...baseDoc,
      financialScore: 80,
      lastUpdatedScore: new Date(),
      creationDate: new Date(),
    });
    expect(op.updateOne.update.$set).not.toHaveProperty("financialScore");
    expect(op.updateOne.update.$set).not.toHaveProperty("lastUpdatedScore");
    expect(op.updateOne.update.$set).not.toHaveProperty("creationDate");
  });
});

/** Batches docs and sums upserted/modified counters from bulkWrite. */
describe("upsertMany", () => {
  function mockResult({ upsertedCount = 0, modifiedCount = 0 } = {}) {
    return { upsertedCount, modifiedCount };
  }
  function makeDocs(n) {
    return Array.from({ length: n }, (_, i) => ({
      clubId: `${i}`,
      name: `Club ${i}`,
      country: "France",
    }));
  }

  test("returns zeroed totals and skips bulkWrite for an empty array", async () => {
    const stats = await upsertMany([]);
    expect(stats).toEqual({ upserted: 0, modified: 0 });
    expect(Club.bulkWrite).not.toHaveBeenCalled();
  });

  test("calls bulkWrite once when docs fit in a single batch", async () => {
    Club.bulkWrite.mockResolvedValueOnce(mockResult({ upsertedCount: 5 }));
    const stats = await upsertMany(makeDocs(5));
    expect(Club.bulkWrite).toHaveBeenCalledTimes(1);
    expect(stats).toEqual({ upserted: 5, modified: 0 });
  });

  test("calls bulkWrite twice when docs exceed the batch size by one", async () => {
    Club.bulkWrite
      .mockResolvedValueOnce(mockResult({ upsertedCount: BATCH_SIZE }))
      .mockResolvedValueOnce(mockResult({ upsertedCount: 1 }));
    const stats = await upsertMany(makeDocs(BATCH_SIZE + 1));
    expect(Club.bulkWrite).toHaveBeenCalledTimes(2);
    expect(stats.upserted).toBe(BATCH_SIZE + 1);
  });

  test("passes { ordered: false } to every bulkWrite call", async () => {
    Club.bulkWrite.mockResolvedValue(mockResult());
    await upsertMany(makeDocs(3));
    expect(Club.bulkWrite).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ ordered: false }),
    );
  });

  test("treats missing upsertedCount / modifiedCount as zero", async () => {
    Club.bulkWrite.mockResolvedValueOnce({});
    const stats = await upsertMany(makeDocs(2));
    expect(stats).toEqual({ upserted: 0, modified: 0 });
  });

  test("propagates errors from bulkWrite", async () => {
    Club.bulkWrite.mockRejectedValueOnce(new Error("boom"));
    await expect(upsertMany(makeDocs(3))).rejects.toThrow("boom");
  });
});

/**
 * External clubs (transfer partners outside the synced league) are created
 * with $setOnInsert only, so an existing club doc — Ligue 1 or otherwise —
 * is never overwritten by a transfer sync.
 */
describe("buildExternalUpsertOp", () => {
  const doc = { clubId: "88", name: "Chelsea", country: "Unknown" };

  test("produces an updateOne with upsert:true and a clubId filter", () => {
    const op = buildExternalUpsertOp(doc);
    expect(op.updateOne.filter).toEqual({ clubId: "88" });
    expect(op.updateOne.upsert).toBe(true);
  });

  test("writes every field via $setOnInsert with isExternal:true and no $set", () => {
    const op = buildExternalUpsertOp(doc);
    expect(op.updateOne.update).toEqual({
      $setOnInsert: {
        clubId: "88",
        name: "Chelsea",
        country: "Unknown",
        isExternal: true,
      },
    });
  });
});

describe("upsertExternalMany", () => {
  test("returns zeroed totals and skips bulkWrite for an empty array", async () => {
    const stats = await upsertExternalMany([]);
    expect(stats).toEqual({ upserted: 0, modified: 0 });
    expect(Club.bulkWrite).not.toHaveBeenCalled();
  });

  test("bulk-upserts external docs and reports upserted count", async () => {
    Club.bulkWrite.mockResolvedValueOnce({ upsertedCount: 2, modifiedCount: 0 });
    const stats = await upsertExternalMany([
      { clubId: "88", name: "Chelsea", country: "Unknown" },
      { clubId: "99", name: "Real Madrid", country: "Unknown" },
    ]);
    expect(Club.bulkWrite).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ ordered: false }),
    );
    expect(stats).toEqual({ upserted: 2, modified: 0 });
  });

  test("treats missing upsertedCount / modifiedCount as zero", async () => {
    Club.bulkWrite.mockResolvedValueOnce({});
    const stats = await upsertExternalMany([
      { clubId: "88", name: "Chelsea", country: "Unknown" },
    ]);
    expect(stats).toEqual({ upserted: 0, modified: 0 });
  });
});

/** Resolves DuckDB club ids to Mongo _ids for ClubSeason linking. */
describe("findIdsByClubId", () => {
  test("returns an empty Map and skips the query for no ids", async () => {
    const map = await findIdsByClubId([]);
    expect(map.size).toBe(0);
    expect(Club.find).not.toHaveBeenCalled();
  });

  test("queries by clubId $in and maps clubId -> _id", async () => {
    Club.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { _id: "a1", clubId: "10004" },
        { _id: "b2", clubId: "583" },
      ]),
    });

    const map = await findIdsByClubId(["10004", "583"]);

    expect(Club.find).toHaveBeenCalledWith(
      { clubId: { $in: ["10004", "583"] } },
      { clubId: 1 },
    );
    expect(map.get("10004")).toBe("a1");
    expect(map.get("583")).toBe("b2");
    expect(map.size).toBe(2);
  });
});
