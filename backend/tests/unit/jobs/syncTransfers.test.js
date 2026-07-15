/**
 * @file Unit tests for the syncTransfers orchestration. The League/Season
 * models, the transfers reader, and the player/club/transfer services are
 * mocked so we only verify the wiring (season resolution by period, player
 * resolution, external-club creation, skip counting, stats). The pure mappers
 * run for real. The full I/O path lives in
 * tests/integration/syncTransfers.int.test.js.
 */

jest.mock("../../../src/models/League", () => ({
  findOne: jest.fn(),
}));
jest.mock("../../../src/models/Season", () => ({
  find: jest.fn(),
}));
jest.mock("../../../src/etl/readers/transfersReader", () => ({
  readTransfers: jest.fn(),
}));
jest.mock("../../../src/services/playerService", () => ({
  findIdsByPlayerId: jest.fn(),
}));
jest.mock("../../../src/services/clubService", () => ({
  findIdsByClubId: jest.fn(),
  upsertExternalMany: jest.fn(),
}));
jest.mock("../../../src/services/transferService", () => ({
  upsertMany: jest.fn(),
}));

const League = require("../../../src/models/League");
const Season = require("../../../src/models/Season");
const { readTransfers } = require("../../../src/etl/readers/transfersReader");
const playerService = require("../../../src/services/playerService");
const clubService = require("../../../src/services/clubService");
const transferService = require("../../../src/services/transferService");
const { run } = require("../../../src/jobs/syncTransfers");

function makeRow(overrides = {}) {
  return {
    playerId: "1",
    date: "2024-08-15",
    season: "24/25",
    sellerClubId: "99",
    buyerClubId: "10",
    sellerName: "Real Madrid",
    buyerName: "Paris SG",
    fee: 180000000,
    ...overrides,
  };
}

/** Season.find(...).lean() resolving to the given seasons. */
function mockSeasons(seasons) {
  Season.find.mockReturnValue({ lean: jest.fn().mockResolvedValue(seasons) });
}

beforeEach(() => {
  jest.clearAllMocks();
  League.findOne.mockResolvedValue({ _id: "league-id", competitionId: "FR1" });
  mockSeasons([{ _id: "season-2425", period: "2024/2025" }]);
  readTransfers.mockResolvedValue([]);
  playerService.findIdsByPlayerId.mockResolvedValue(new Map([["1", "p1"]]));
  clubService.findIdsByClubId.mockResolvedValue(
    new Map([
      ["10", "c10"],
      ["99", "c99"],
    ]),
  );
  clubService.upsertExternalMany.mockResolvedValue({ upserted: 0, modified: 0 });
  transferService.upsertMany.mockResolvedValue({ upserted: 0, modified: 0 });
});

describe("syncTransfers.run", () => {
  test("throws a clear error when the league is not found", async () => {
    League.findOne.mockResolvedValue(null);
    await expect(run({ competitionId: "FR1" })).rejects.toThrow(
      /league not found/i,
    );
    expect(readTransfers).not.toHaveBeenCalled();
  });

  test("forwards dbPath to the reader", async () => {
    await run({ dbPath: "/tmp/x.duckdb" });
    expect(readTransfers).toHaveBeenCalledWith({ dbPath: "/tmp/x.duckdb" });
  });

  test("defaults to competition FR1", async () => {
    await run();
    expect(League.findOne).toHaveBeenCalledWith({ competitionId: "FR1" });
  });

  test("builds a fully-linked transfer doc", async () => {
    readTransfers.mockResolvedValue([makeRow()]);

    await run();

    expect(transferService.upsertMany).toHaveBeenCalledWith([
      {
        player: "p1",
        buyer: "c10",
        seller: "c99",
        season: "season-2425",
        date: new Date("2024-08-15T00:00:00.000Z"),
        price: 180000000,
        window: "summer",
      },
    ]);
  });

  test("creates missing clubs as external and links them", async () => {
    readTransfers.mockResolvedValue([
      makeRow({ buyerClubId: "88", buyerName: "Chelsea" }),
    ]);
    // First resolution: only the seller is known; after the external upsert
    // the second resolution also knows the buyer.
    clubService.findIdsByClubId
      .mockResolvedValueOnce(new Map([["99", "c99"]]))
      .mockResolvedValueOnce(new Map([["88", "c88"]]));
    clubService.upsertExternalMany.mockResolvedValue({
      upserted: 1,
      modified: 0,
    });

    const stats = await run();

    expect(clubService.upsertExternalMany).toHaveBeenCalledWith([
      { clubId: "88", name: "Chelsea", country: "Unknown" },
    ]);
    expect(stats.externalClubsUpserted).toBe(1);
    const doc = transferService.upsertMany.mock.calls[0][0][0];
    expect(doc.buyer).toBe("c88");
    expect(doc.seller).toBe("c99");
  });

  test("does not touch clubs when every transfer club already exists", async () => {
    readTransfers.mockResolvedValue([makeRow()]);

    await run();

    expect(clubService.upsertExternalMany).not.toHaveBeenCalled();
    expect(clubService.findIdsByClubId).toHaveBeenCalledTimes(1);
  });

  test("skips transfers whose season period has not been synced", async () => {
    readTransfers.mockResolvedValue([
      makeRow(),
      makeRow({ season: "93/94", date: "1993-07-01" }),
    ]);

    const stats = await run();

    expect(stats.skippedUnresolvedSeason).toBe(1);
    expect(transferService.upsertMany.mock.calls[0][0]).toHaveLength(1);
  });

  test("skips transfers whose player is not in Mongo", async () => {
    readTransfers.mockResolvedValue([makeRow(), makeRow({ playerId: "77" })]);

    const stats = await run();

    expect(stats.skippedUnresolvedPlayer).toBe(1);
    expect(transferService.upsertMany.mock.calls[0][0]).toHaveLength(1);
  });

  test("skips rows failing validation and counts them", async () => {
    readTransfers.mockResolvedValue([makeRow(), makeRow({ buyerClubId: null })]);

    const stats = await run();

    expect(stats.skippedInvalid).toBe(1);
    expect(transferService.upsertMany.mock.calls[0][0]).toHaveLength(1);
  });

  test("omits the seller when the source has none", async () => {
    readTransfers.mockResolvedValue([
      makeRow({ sellerClubId: null, sellerName: null }),
    ]);

    await run();

    const doc = transferService.upsertMany.mock.calls[0][0][0];
    expect(doc.seller).toBeUndefined();
  });

  test("returns aggregated stats", async () => {
    readTransfers.mockResolvedValue([makeRow()]);
    transferService.upsertMany.mockResolvedValue({ upserted: 1, modified: 0 });

    const stats = await run();

    expect(stats).toEqual({
      inspected: 1,
      skippedInvalid: 0,
      skippedUnresolvedSeason: 0,
      skippedUnresolvedPlayer: 0,
      externalClubsUpserted: 0,
      transfersSynced: 1,
      transfersUpserted: 1,
      transfersModified: 0,
    });
  });
});
