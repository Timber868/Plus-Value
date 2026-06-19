/**
 * @file Unit tests for the orchestrator. The dataset download, the seasons
 * reader, and the three sync jobs are mocked so we only verify the
 * orchestration contract: stages run in dependency order, the `allSeasons`
 * backfill flag controls whether every available season or just the given one
 * is synced, season/competition are forwarded, and each stage's result is
 * returned.
 */

jest.mock("../../../src/jobs/marketDataset", () => ({
  downloadDataset: jest.fn(),
}));
jest.mock("../../../src/etl/readers/seasonsReader", () => ({
  readSeasons: jest.fn(),
}));
jest.mock("../../../src/jobs/syncLeagues", () => ({
  run: jest.fn(),
}));
jest.mock("../../../src/jobs/syncSeasons", () => ({
  run: jest.fn(),
}));
jest.mock("../../../src/jobs/syncClubs", () => ({
  run: jest.fn(),
}));

const { downloadDataset } = require("../../../src/jobs/marketDataset");
const { readSeasons } = require("../../../src/etl/readers/seasonsReader");
const syncLeagues = require("../../../src/jobs/syncLeagues");
const syncSeasons = require("../../../src/jobs/syncSeasons");
const syncClubs = require("../../../src/jobs/syncClubs");
const { run } = require("../../../src/jobs/orchestrator");

beforeEach(() => {
  jest.clearAllMocks();
  downloadDataset.mockResolvedValue("/data/market-datasets.duckdb");
  readSeasons.mockResolvedValue(["2023", "2024", "2025"]);
  syncLeagues.run.mockResolvedValue({ synced: 1 });
  syncSeasons.run.mockResolvedValue({ period: "2025/2026" });
  syncClubs.run.mockResolvedValue({ clubsSynced: 3 });
});

describe("orchestrator.run", () => {
  test("runs the top-level stages in dependency order", async () => {
    const order = [];
    downloadDataset.mockImplementation(async () => {
      order.push("dataset");
      return "/data/x.duckdb";
    });
    syncLeagues.run.mockImplementation(async () => {
      order.push("leagues");
      return {};
    });
    syncSeasons.run.mockImplementation(async () => {
      order.push("seasons");
      return {};
    });
    syncClubs.run.mockImplementation(async () => {
      order.push("clubs");
      return {};
    });

    await run({ season: "2025", competitionId: "FR1" });

    expect(order).toEqual(["dataset", "leagues", "seasons", "clubs"]);
  });

  test("syncs only the given season by default and never reads available seasons", async () => {
    await run({ season: "2025", competitionId: "FR1" });

    expect(readSeasons).not.toHaveBeenCalled();
    expect(syncSeasons.run).toHaveBeenCalledTimes(1);
    expect(syncSeasons.run).toHaveBeenCalledWith({
      season: "2025",
      competitionId: "FR1",
    });
    expect(syncClubs.run).toHaveBeenCalledWith({
      season: "2025",
      competitionId: "FR1",
    });
  });

  test("backfills every available season when allSeasons is set", async () => {
    readSeasons.mockResolvedValue(["2023", "2024", "2025"]);

    await run({ competitionId: "FR1", allSeasons: true });

    expect(readSeasons).toHaveBeenCalledWith({ competitionId: "FR1" });
    expect(syncSeasons.run.mock.calls.map((c) => c[0].season)).toEqual([
      "2023",
      "2024",
      "2025",
    ]);
    expect(syncClubs.run.mock.calls.map((c) => c[0].season)).toEqual([
      "2023",
      "2024",
      "2025",
    ]);
  });

  test("syncs clubs after the season within each year", async () => {
    readSeasons.mockResolvedValue(["2024", "2025"]);
    const order = [];
    syncSeasons.run.mockImplementation(async ({ season }) => {
      order.push(`season:${season}`);
      return {};
    });
    syncClubs.run.mockImplementation(async ({ season }) => {
      order.push(`clubs:${season}`);
      return {};
    });

    await run({ competitionId: "FR1", allSeasons: true });

    expect(order).toEqual([
      "season:2024",
      "clubs:2024",
      "season:2025",
      "clubs:2025",
    ]);
  });

  test("returns dataset, leagues and a result per synced season", async () => {
    readSeasons.mockResolvedValue(["2024", "2025"]);
    syncSeasons.run.mockResolvedValue({ period: "p" });
    syncClubs.run.mockResolvedValue({ clubsSynced: 3 });

    const stats = await run({ competitionId: "FR1", allSeasons: true });

    expect(stats).toEqual({
      dataset: "/data/market-datasets.duckdb",
      leagues: { synced: 1 },
      results: [
        {
          season: "2024",
          seasonStats: { period: "p" },
          clubStats: { clubsSynced: 3 },
        },
        {
          season: "2025",
          seasonStats: { period: "p" },
          clubStats: { clubsSynced: 3 },
        },
      ],
    });
  });
});
