/**
 * @file Unit tests for the Player service. The Player and Person models are
 * mocked so these run without a Mongo instance; the full Mongo path is
 * exercised in tests/integration/syncPlayers.int.test.js.
 *
 * Unlike the single-collection services, upsertMany here writes two linked
 * collections: unseen playerIds insert a Person then a Player pointing at it,
 * while already-known playerIds only refresh the linked Person's fields.
 */

jest.mock("../../../src/models/Player", () => ({
  find: jest.fn(),
  insertMany: jest.fn(),
  bulkWrite: jest.fn(),
}));
jest.mock("../../../src/models/Person", () => ({
  insertMany: jest.fn(),
  bulkWrite: jest.fn(),
}));

const Player = require("../../../src/models/Player");
const Person = require("../../../src/models/Person");
const {
  upsertMany,
  findIdsByPlayerId,
  BATCH_SIZE,
} = require("../../../src/services/playerService");

/** Player.find(...).lean() resolving to the given existing players. */
function mockExisting(existing) {
  Player.find.mockReturnValue({ lean: jest.fn().mockResolvedValue(existing) });
}

function makeDoc(i) {
  return {
    playerId: `${i}`,
    name: `Player ${i}`,
    birthDate: new Date("1990-01-01"),
    nationality: "France",
    position: "Attack",
    subPosition: "Centre-Forward",
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockExisting([]);
  Person.insertMany.mockImplementation(async (docs) =>
    docs.map((d, idx) => ({ ...d, _id: `person-${idx}` })),
  );
  Player.insertMany.mockResolvedValue([]);
  Person.bulkWrite.mockResolvedValue({ modifiedCount: 0 });
});

describe("upsertMany", () => {
  test("returns zeroed totals and touches no model for an empty array", async () => {
    const stats = await upsertMany([]);
    expect(stats).toEqual({ upserted: 0, modified: 0 });
    expect(Player.find).not.toHaveBeenCalled();
    expect(Person.insertMany).not.toHaveBeenCalled();
    expect(Person.bulkWrite).not.toHaveBeenCalled();
  });

  test("inserts a Person then a linked Player for unseen playerIds", async () => {
    const stats = await upsertMany([makeDoc(1), makeDoc(2)]);

    expect(Person.insertMany).toHaveBeenCalledTimes(1);
    expect(Person.insertMany.mock.calls[0][0]).toEqual([
      { name: "Player 1", birthDate: new Date("1990-01-01"), nationality: "France" },
      { name: "Player 2", birthDate: new Date("1990-01-01"), nationality: "France" },
    ]);

    expect(Player.insertMany).toHaveBeenCalledWith([
      { playerId: "1", person: "person-0", position: "Attack", subPosition: "Centre-Forward" },
      { playerId: "2", person: "person-1", position: "Attack", subPosition: "Centre-Forward" },
    ]);

    expect(stats).toEqual({ upserted: 2, modified: 0 });
  });

  test("refreshes the linked Person for already-known playerIds", async () => {
    mockExisting([{ playerId: "1", person: "person-a" }]);
    Person.bulkWrite.mockResolvedValue({ modifiedCount: 1 });

    const doc = makeDoc(1);
    const stats = await upsertMany([doc]);

    expect(Person.insertMany).not.toHaveBeenCalled();
    expect(Player.insertMany).not.toHaveBeenCalled();
    expect(Person.bulkWrite).toHaveBeenCalledWith(
      [
        {
          updateOne: {
            filter: { _id: "person-a" },
            update: {
              $set: {
                name: doc.name,
                birthDate: doc.birthDate,
                nationality: doc.nationality,
              },
            },
          },
        },
      ],
      { ordered: false },
    );
    expect(Player.bulkWrite).toHaveBeenCalledWith(
      [
        {
          updateOne: {
            filter: { playerId: "1" },
            update: { $set: { position: "Attack", subPosition: "Centre-Forward" } },
          },
        },
      ],
      { ordered: false },
    );
    expect(stats).toEqual({ upserted: 0, modified: 1 });
  });

  test("handles a mix of new and existing players in one call", async () => {
    mockExisting([{ playerId: "1", person: "person-a" }]);
    Person.bulkWrite.mockResolvedValue({ modifiedCount: 1 });

    const stats = await upsertMany([makeDoc(1), makeDoc(2)]);

    expect(Person.insertMany.mock.calls[0][0]).toHaveLength(1);
    expect(Player.insertMany.mock.calls[0][0]).toEqual([
      { playerId: "2", person: "person-0", position: "Attack", subPosition: "Centre-Forward" },
    ]);
    expect(stats).toEqual({ upserted: 1, modified: 1 });
  });

  test("processes docs in batches of BATCH_SIZE", async () => {
    const docs = Array.from({ length: BATCH_SIZE + 1 }, (_, i) => makeDoc(i));
    await upsertMany(docs);

    expect(Player.find).toHaveBeenCalledTimes(2);
    expect(Person.insertMany).toHaveBeenCalledTimes(2);
    expect(Person.insertMany.mock.calls[0][0]).toHaveLength(BATCH_SIZE);
    expect(Person.insertMany.mock.calls[1][0]).toHaveLength(1);
  });

  test("treats a missing modifiedCount as zero", async () => {
    mockExisting([{ playerId: "1", person: "person-a" }]);
    Person.bulkWrite.mockResolvedValue({});

    const stats = await upsertMany([makeDoc(1)]);
    expect(stats).toEqual({ upserted: 0, modified: 0 });
  });

  test("propagates errors from the underlying writes", async () => {
    Person.insertMany.mockRejectedValueOnce(new Error("boom"));
    await expect(upsertMany([makeDoc(1)])).rejects.toThrow("boom");
  });
});

/** Resolves DuckDB player ids to Mongo _ids for valuation/transfer linking. */
describe("findIdsByPlayerId", () => {
  test("returns an empty Map and skips the query for no ids", async () => {
    const map = await findIdsByPlayerId([]);
    expect(map.size).toBe(0);
    expect(Player.find).not.toHaveBeenCalled();
  });

  test("queries by playerId $in and maps playerId -> _id", async () => {
    mockExisting([
      { _id: "a1", playerId: "1" },
      { _id: "b2", playerId: "2" },
    ]);

    const map = await findIdsByPlayerId(["1", "2"]);

    expect(Player.find).toHaveBeenCalledWith(
      { playerId: { $in: ["1", "2"] } },
      { playerId: 1 },
    );
    expect(map.get("1")).toBe("a1");
    expect(map.get("2")).toBe("b2");
    expect(map.size).toBe(2);
  });
});
