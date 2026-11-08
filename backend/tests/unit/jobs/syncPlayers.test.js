/**
 * @file Unit tests for the syncPlayers orchestration. The players reader and
 * the player service are mocked so we only verify the wiring (row shaping,
 * skip counting, stats). The pure mappers run for real. The full I/O path
 * lives in tests/integration/syncPlayers.int.test.js.
 */

jest.mock("../../../src/etl/readers/playersReader", () => ({
  readPlayers: jest.fn(),
}));
jest.mock("../../../src/services/playerService", () => ({
  upsertMany: jest.fn(),
}));

const { readPlayers } = require("../../../src/etl/readers/playersReader");
const playerService = require("../../../src/services/playerService");
const { run } = require("../../../src/jobs/syncPlayers");

function makeRow(overrides = {}) {
  return {
    playerId: "1",
    name: "Kylian Mbappé",
    birthDate: "1998-12-20",
    nationality: "France",
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  readPlayers.mockResolvedValue([]);
  playerService.upsertMany.mockResolvedValue({ upserted: 0, modified: 0 });
});

describe("syncPlayers.run", () => {
  test("forwards dbPath to the reader", async () => {
    await run({ dbPath: "/tmp/x.duckdb" });
    expect(readPlayers).toHaveBeenCalledWith({ dbPath: "/tmp/x.duckdb" });
  });

  test("runs without options (production defaults)", async () => {
    await run();
    expect(readPlayers).toHaveBeenCalledWith({ dbPath: undefined });
  });

  test("maps rows through toPlayerDoc before upserting", async () => {
    readPlayers.mockResolvedValue([makeRow()]);

    await run();

    expect(playerService.upsertMany).toHaveBeenCalledWith([
      {
        playerId: "1",
        name: "Kylian Mbappé",
        birthDate: new Date("1998-12-20T00:00:00.000Z"),
        nationality: "France",
        position: null,
        subPosition: null,
      },
    ]);
  });

  test("skips rows missing a required Person field and counts them", async () => {
    readPlayers.mockResolvedValue([
      makeRow({ playerId: "1" }),
      makeRow({ playerId: "2", birthDate: null }),
      makeRow({ playerId: "3", nationality: null }),
      makeRow({ playerId: "4", name: null }),
    ]);

    const stats = await run();

    expect(stats.inspected).toBe(4);
    expect(stats.skipped).toBe(3);
    expect(playerService.upsertMany.mock.calls[0][0]).toHaveLength(1);
  });

  test("returns aggregated stats", async () => {
    readPlayers.mockResolvedValue([makeRow({ playerId: "1" }), makeRow({ playerId: "2" })]);
    playerService.upsertMany.mockResolvedValue({ upserted: 2, modified: 0 });

    const stats = await run();

    expect(stats).toEqual({
      inspected: 2,
      skipped: 0,
      playersSynced: 2,
      playersUpserted: 2,
      personsModified: 0,
    });
  });
});
