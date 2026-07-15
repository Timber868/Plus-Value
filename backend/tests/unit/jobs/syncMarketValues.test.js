/**
 * @file Unit tests for the syncMarketValues orchestration. The valuations
 * reader and the player/marketValue services are mocked so we only verify the
 * wiring (row shaping, player resolution, skip counting, stats). The pure
 * mappers run for real. The full I/O path lives in
 * tests/integration/syncMarketValues.int.test.js.
 */

jest.mock("../../../src/etl/readers/playerValuationsReader", () => ({
  readPlayerValuations: jest.fn(),
}));
jest.mock("../../../src/services/playerService", () => ({
  findIdsByPlayerId: jest.fn(),
}));
jest.mock("../../../src/services/marketValueService", () => ({
  upsertMany: jest.fn(),
}));

const {
  readPlayerValuations,
} = require("../../../src/etl/readers/playerValuationsReader");
const playerService = require("../../../src/services/playerService");
const marketValueService = require("../../../src/services/marketValueService");
const { run } = require("../../../src/jobs/syncMarketValues");

function makeRow(overrides = {}) {
  return { playerId: "1", date: "2024-08-01", value: 150000000, ...overrides };
}

beforeEach(() => {
  jest.clearAllMocks();
  readPlayerValuations.mockResolvedValue([]);
  playerService.findIdsByPlayerId.mockResolvedValue(new Map());
  marketValueService.upsertMany.mockResolvedValue({ upserted: 0, modified: 0 });
});

describe("syncMarketValues.run", () => {
  test("forwards dbPath to the reader", async () => {
    await run({ dbPath: "/tmp/x.duckdb" });
    expect(readPlayerValuations).toHaveBeenCalledWith({
      dbPath: "/tmp/x.duckdb",
    });
  });

  test("runs without options (production defaults)", async () => {
    await run();
    expect(readPlayerValuations).toHaveBeenCalledWith({ dbPath: undefined });
  });

  test("resolves each distinct playerId exactly once", async () => {
    readPlayerValuations.mockResolvedValue([
      makeRow({ playerId: "1", date: "2024-08-01" }),
      makeRow({ playerId: "1", date: "2025-02-01" }),
      makeRow({ playerId: "2", date: "2024-08-01" }),
    ]);
    playerService.findIdsByPlayerId.mockResolvedValue(
      new Map([
        ["1", "oid1"],
        ["2", "oid2"],
      ]),
    );

    await run();

    expect(playerService.findIdsByPlayerId).toHaveBeenCalledWith(["1", "2"]);
  });

  test("links the resolved player _id into each MarketValue doc", async () => {
    readPlayerValuations.mockResolvedValue([makeRow()]);
    playerService.findIdsByPlayerId.mockResolvedValue(new Map([["1", "oid1"]]));

    await run();

    expect(marketValueService.upsertMany).toHaveBeenCalledWith([
      {
        player: "oid1",
        date: new Date("2024-08-01T00:00:00.000Z"),
        value: 150000000,
      },
    ]);
  });

  test("skips invalid rows and counts them separately", async () => {
    readPlayerValuations.mockResolvedValue([
      makeRow({ playerId: "1" }),
      makeRow({ playerId: "1", date: "2023-01-01", value: -5 }),
    ]);
    playerService.findIdsByPlayerId.mockResolvedValue(new Map([["1", "oid1"]]));

    const stats = await run();

    expect(stats.skippedInvalid).toBe(1);
    expect(marketValueService.upsertMany.mock.calls[0][0]).toHaveLength(1);
  });

  test("skips rows whose player is not in Mongo and counts them separately", async () => {
    readPlayerValuations.mockResolvedValue([
      makeRow({ playerId: "1" }),
      makeRow({ playerId: "99" }),
    ]);
    playerService.findIdsByPlayerId.mockResolvedValue(new Map([["1", "oid1"]]));

    const stats = await run();

    expect(stats.skippedUnresolvedPlayer).toBe(1);
    expect(marketValueService.upsertMany.mock.calls[0][0]).toHaveLength(1);
  });

  test("returns aggregated stats", async () => {
    readPlayerValuations.mockResolvedValue([
      makeRow({ playerId: "1", date: "2024-08-01" }),
      makeRow({ playerId: "1", date: "2025-02-01" }),
    ]);
    playerService.findIdsByPlayerId.mockResolvedValue(new Map([["1", "oid1"]]));
    marketValueService.upsertMany.mockResolvedValue({
      upserted: 2,
      modified: 0,
    });

    const stats = await run();

    expect(stats).toEqual({
      inspected: 2,
      skippedInvalid: 0,
      skippedUnresolvedPlayer: 0,
      marketValuesSynced: 2,
      marketValuesUpserted: 2,
      marketValuesModified: 0,
    });
  });
});
