/**
 * @file Unit tests for the Season service. `Season.findOneAndUpdate` is mocked
 * so these run without a Mongo instance. The real path is exercised in
 * tests/integration/syncSeasons.int.test.js.
 */

jest.mock("../models/Season", () => ({
  findOneAndUpdate: jest.fn(),
}));

const Season = require("../models/Season");
const { upsertSeason } = require("./seasonService");

beforeEach(() => {
  Season.findOneAndUpdate.mockReset();
});

describe("upsertSeason", () => {
  const input = {
    league: "league-id",
    startDate: new Date("2025-08-01T00:00:00.000Z"),
    endDate: new Date("2026-05-31T00:00:00.000Z"),
    period: "2025/2026",
  };

  test("upserts on (league, period) and returns the season doc", async () => {
    const doc = { _id: "season-id", ...input };
    Season.findOneAndUpdate.mockResolvedValueOnce(doc);

    const result = await upsertSeason(input);

    expect(result).toBe(doc);
    const [filter, , options] = Season.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ league: "league-id", period: "2025/2026" });
    expect(options).toEqual(
      expect.objectContaining({ upsert: true, new: true }),
    );
  });

  // startDate/endDate are immutable on the schema; using $setOnInsert means a
  // re-sync of an existing season never tries (and fails) to rewrite them.
  test("writes the immutable fields only on insert via $setOnInsert", async () => {
    Season.findOneAndUpdate.mockResolvedValueOnce({});
    await upsertSeason(input);

    const update = Season.findOneAndUpdate.mock.calls[0][1];
    expect(update.$setOnInsert).toEqual({
      league: "league-id",
      startDate: input.startDate,
      endDate: input.endDate,
      period: "2025/2026",
    });
  });

  test("propagates errors from findOneAndUpdate", async () => {
    Season.findOneAndUpdate.mockRejectedValueOnce(new Error("mongo down"));
    await expect(upsertSeason(input)).rejects.toThrow("mongo down");
  });
});
