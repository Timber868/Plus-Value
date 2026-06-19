/**
 * @file Unit tests for the syncClubs orchestration. The League and Season
 * models, the standings reader, and the club/clubSeason services are mocked so
 * we only verify the wiring (league lookup, season lookup by derived period,
 * country injection, standing assignment, skip counting, stats). The pure
 * mappers run for real. The full I/O path lives in
 * tests/integration/syncClubs.int.test.js.
 */

jest.mock("../../../src/models/League", () => ({
  findOne: jest.fn(),
}));
jest.mock("../../../src/models/Season", () => ({
  findOne: jest.fn(),
}));
jest.mock("../../../src/etl/readers/standingsReader", () => ({
  readStandings: jest.fn(),
}));
jest.mock("../../../src/services/clubService", () => ({
  upsertMany: jest.fn(),
  findIdsByClubId: jest.fn(),
}));
jest.mock("../../../src/services/clubSeasonService", () => ({
  upsertMany: jest.fn(),
}));

const League = require("../../../src/models/League");
const Season = require("../../../src/models/Season");
const { readStandings } = require("../../../src/etl/readers/standingsReader");
const clubService = require("../../../src/services/clubService");
const clubSeasonService = require("../../../src/services/clubSeasonService");
const { run } = require("../../../src/jobs/syncClubs");

function makeRow(overrides = {}) {
  return {
    clubId: "1",
    name: "Club A",
    points: 7,
    goalDiff: 3,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Sensible defaults; individual tests override as needed.
  League.findOne.mockResolvedValue({
    _id: "league-id",
    competitionId: "FR1",
    country: "France",
  });
  Season.findOne.mockResolvedValue({ _id: "season-id" });
  clubService.upsertMany.mockResolvedValue({ upserted: 0, modified: 0 });
  clubService.findIdsByClubId.mockResolvedValue(new Map());
  clubSeasonService.upsertMany.mockResolvedValue({ upserted: 0, modified: 0 });
});

describe("syncClubs.run", () => {
  test("throws a clear error when the league is not found", async () => {
    League.findOne.mockResolvedValue(null);

    await expect(run({ season: "2025", competitionId: "FR1" })).rejects.toThrow(
      /league not found/i,
    );
    expect(readStandings).not.toHaveBeenCalled();
  });

  test("throws a clear error when the season has not been synced yet", async () => {
    Season.findOne.mockResolvedValue(null);

    await expect(run({ season: "2025", competitionId: "FR1" })).rejects.toThrow(
      /season not found/i,
    );
    expect(readStandings).not.toHaveBeenCalled();
  });

  test("looks up the league by competitionId", async () => {
    readStandings.mockResolvedValue([]);
    await run({ season: "2025", competitionId: "FR1" });
    expect(League.findOne).toHaveBeenCalledWith({ competitionId: "FR1" });
  });

  test("looks up the season by league and derived period", async () => {
    readStandings.mockResolvedValue([]);
    await run({ season: "2025", competitionId: "FR1" });
    expect(Season.findOne).toHaveBeenCalledWith({
      league: "league-id",
      period: "2025/2026",
    });
  });

  test("forwards season, competitionId and dbPath to the reader", async () => {
    readStandings.mockResolvedValue([]);
    await run({ season: "2025", competitionId: "FR1", dbPath: "/tmp/x.duckdb" });
    expect(readStandings).toHaveBeenCalledWith({
      season: "2025",
      competitionId: "FR1",
      dbPath: "/tmp/x.duckdb",
    });
  });

  test("injects the league country into each club doc", async () => {
    readStandings.mockResolvedValue([
      makeRow({ clubId: "1", name: "Club A" }),
      makeRow({ clubId: "2", name: "Club B" }),
    ]);

    await run({ season: "2025", competitionId: "FR1" });

    const clubDocs = clubService.upsertMany.mock.calls[0][0];
    expect(clubDocs).toEqual([
      { clubId: "1", name: "Club A", country: "France" },
      { clubId: "2", name: "Club B", country: "France" },
    ]);
  });

  test("assigns standing from the reader order and links resolved club ids", async () => {
    readStandings.mockResolvedValue([
      makeRow({ clubId: "1", name: "Club A", points: 7 }),
      makeRow({ clubId: "2", name: "Club B", points: 4 }),
      makeRow({ clubId: "3", name: "Club C", points: 0 }),
    ]);
    clubService.findIdsByClubId.mockResolvedValue(
      new Map([
        ["1", "oid1"],
        ["2", "oid2"],
        ["3", "oid3"],
      ]),
    );

    await run({ season: "2025", competitionId: "FR1" });

    const csDocs = clubSeasonService.upsertMany.mock.calls[0][0];
    expect(csDocs).toEqual([
      { club: "oid1", season: "season-id", points: 7, standing: 1 },
      { club: "oid2", season: "season-id", points: 4, standing: 2 },
      { club: "oid3", season: "season-id", points: 0, standing: 3 },
    ]);
  });

  test("skips rows that produce an invalid club doc and counts them", async () => {
    readStandings.mockResolvedValue([
      makeRow({ clubId: "1", name: "Club A" }),
      makeRow({ clubId: "", name: "No Id" }),
    ]);
    clubService.findIdsByClubId.mockResolvedValue(new Map([["1", "oid1"]]));

    const stats = await run({ season: "2025", competitionId: "FR1" });

    expect(stats.inspected).toBe(2);
    expect(stats.skipped).toBe(1);
    expect(clubService.upsertMany.mock.calls[0][0]).toHaveLength(1);
  });

  // A skipped club must not leak into the ClubSeason rows even if findIds
  // happens to return an id for it.
  test("only builds ClubSeason rows for clubs whose id resolved", async () => {
    readStandings.mockResolvedValue([
      makeRow({ clubId: "1", name: "Club A" }),
      makeRow({ clubId: "2", name: "Club B" }),
    ]);
    // Club B's id did not resolve (e.g. upsert race / unexpected miss).
    clubService.findIdsByClubId.mockResolvedValue(new Map([["1", "oid1"]]));

    await run({ season: "2025", competitionId: "FR1" });

    const csDocs = clubSeasonService.upsertMany.mock.calls[0][0];
    expect(csDocs).toEqual([
      { club: "oid1", season: "season-id", points: 7, standing: 1 },
    ]);
  });

  test("returns aggregated stats", async () => {
    readStandings.mockResolvedValue([
      makeRow({ clubId: "1", name: "Club A" }),
      makeRow({ clubId: "2", name: "Club B" }),
    ]);
    clubService.findIdsByClubId.mockResolvedValue(
      new Map([
        ["1", "oid1"],
        ["2", "oid2"],
      ]),
    );
    clubService.upsertMany.mockResolvedValue({ upserted: 2, modified: 0 });
    clubSeasonService.upsertMany.mockResolvedValue({ upserted: 2, modified: 0 });

    const stats = await run({ season: "2025", competitionId: "FR1" });

    expect(stats).toEqual({
      inspected: 2,
      skipped: 0,
      clubsSynced: 2,
      clubsUpserted: 2,
      clubsModified: 0,
      clubSeasonsSynced: 2,
      clubSeasonsUpserted: 2,
      clubSeasonsModified: 0,
    });
  });
});
