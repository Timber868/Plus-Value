/**
 * @file Unit tests for the syncSeasons orchestration. The League model, the
 * standings reader, and all three services are mocked so we only verify the
 * wiring (league lookup, season upsert, country injection, standing
 * assignment, skip counting, stats). The pure mappers run for real. The full
 * I/O path lives in tests/integration/syncSeasons.int.test.js.
 */

jest.mock("../models/League", () => ({
  findOne: jest.fn(),
}));
jest.mock("../etl/readers/standingsReader", () => ({
  readStandings: jest.fn(),
}));
jest.mock("../services/seasonService", () => ({
  upsertSeason: jest.fn(),
}));
jest.mock("../services/clubService", () => ({
  upsertMany: jest.fn(),
  findIdsByClubId: jest.fn(),
}));
jest.mock("../services/clubSeasonService", () => ({
  upsertMany: jest.fn(),
}));

const League = require("../models/League");
const { readStandings } = require("../etl/readers/standingsReader");
const seasonService = require("../services/seasonService");
const clubService = require("../services/clubService");
const clubSeasonService = require("../services/clubSeasonService");
const { run } = require("./syncSeasons");

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
  seasonService.upsertSeason.mockResolvedValue({ _id: "season-id" });
  clubService.upsertMany.mockResolvedValue({ upserted: 0, modified: 0 });
  clubService.findIdsByClubId.mockResolvedValue(new Map());
  clubSeasonService.upsertMany.mockResolvedValue({ upserted: 0, modified: 0 });
});

describe("syncSeasons.run", () => {
  test("throws a clear error when the league is not found", async () => {
    League.findOne.mockResolvedValue(null);

    await expect(run({ season: "2025", competitionId: "FR1" })).rejects.toThrow(
      /league not found/i,
    );
    expect(readStandings).not.toHaveBeenCalled();
    expect(seasonService.upsertSeason).not.toHaveBeenCalled();
  });

  test("looks up the league by competitionId", async () => {
    readStandings.mockResolvedValue([]);
    await run({ season: "2025", competitionId: "FR1" });
    expect(League.findOne).toHaveBeenCalledWith({ competitionId: "FR1" });
  });

  test("upserts the season with the derived dates and period", async () => {
    readStandings.mockResolvedValue([]);
    await run({ season: "2025", competitionId: "FR1" });

    expect(seasonService.upsertSeason).toHaveBeenCalledWith({
      league: "league-id",
      startDate: new Date("2025-08-01T00:00:00.000Z"),
      endDate: new Date("2026-05-31T00:00:00.000Z"),
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
      period: "2025/2026",
      clubsSynced: 2,
      clubsUpserted: 2,
      clubsModified: 0,
      clubSeasonsSynced: 2,
      clubSeasonsUpserted: 2,
      clubSeasonsModified: 0,
    });
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

  test("still upserts the season when there are no standings rows", async () => {
    readStandings.mockResolvedValue([]);
    const stats = await run({ season: "2025", competitionId: "FR1" });

    expect(seasonService.upsertSeason).toHaveBeenCalledTimes(1);
    expect(clubService.upsertMany).toHaveBeenCalledWith([]);
    expect(stats.clubsSynced).toBe(0);
    expect(stats.clubSeasonsSynced).toBe(0);
  });
});
