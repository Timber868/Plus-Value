/**
 * @file Unit tests for the syncSeasons orchestration. The League model and the
 * season service are mocked so we only verify the wiring (league lookup, season
 * upsert with derived dates/period, returned period). The pure seasonMapper
 * runs for real. The full I/O path lives in
 * tests/integration/syncSeasons.int.test.js.
 */

jest.mock("../../../src/models/League", () => ({
  findOne: jest.fn(),
}));
jest.mock("../../../src/services/seasonService", () => ({
  upsertSeason: jest.fn(),
}));

const League = require("../../../src/models/League");
const seasonService = require("../../../src/services/seasonService");
const { run } = require("../../../src/jobs/syncSeasons");

beforeEach(() => {
  jest.clearAllMocks();
  League.findOne.mockResolvedValue({
    _id: "league-id",
    competitionId: "FR1",
    country: "France",
  });
  seasonService.upsertSeason.mockResolvedValue({ _id: "season-id" });
});

describe("syncSeasons.run", () => {
  test("throws a clear error when the league is not found", async () => {
    League.findOne.mockResolvedValue(null);

    await expect(run({ season: "2025", competitionId: "FR1" })).rejects.toThrow(
      /league not found/i,
    );
    expect(seasonService.upsertSeason).not.toHaveBeenCalled();
  });

  test("looks up the league by competitionId", async () => {
    await run({ season: "2025", competitionId: "FR1" });
    expect(League.findOne).toHaveBeenCalledWith({ competitionId: "FR1" });
  });

  test("upserts the season with the derived dates and period", async () => {
    await run({ season: "2025", competitionId: "FR1" });

    expect(seasonService.upsertSeason).toHaveBeenCalledWith({
      league: "league-id",
      startDate: new Date("2025-08-01T00:00:00.000Z"),
      endDate: new Date("2026-05-31T00:00:00.000Z"),
      period: "2025/2026",
    });
  });

  test("returns the derived period", async () => {
    const stats = await run({ season: "2025", competitionId: "FR1" });
    expect(stats).toEqual({ period: "2025/2026" });
  });
});
