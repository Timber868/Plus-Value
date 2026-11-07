/**
 * @file Unit tests for the market value time series with mocked models. The
 * real query runs against an in-memory MongoDB in playerMarketValueService.db.test.js.
 */

jest.mock("../../../src/models/Player", () => ({ exists: jest.fn() }));
jest.mock("../../../src/models/MarketValue", () => ({ find: jest.fn() }));

const Player = require("../../../src/models/Player");
const MarketValue = require("../../../src/models/MarketValue");
const { parseDateRange, getMarketValueSeries } = require("../../../src/services/playerMarketValueService");

describe("parseDateRange", () => {
  it("returns no bounds when none are given", () => {
    expect(parseDateRange({})).toEqual({ from: null, to: null });
  });

  it("parses plain dates and ISO timestamps", () => {
    expect(parseDateRange({ from: "2020-01-01", to: "2024-06-01T12:00:00Z" })).toEqual({
      from: new Date("2020-01-01"),
      to: new Date("2024-06-01T12:00:00Z"),
    });
  });

  it("rejects malformed dates", () => {
    expect(parseDateRange({ from: "yesterday" })).toEqual({ error: expect.stringContaining("from") });
    expect(parseDateRange({ to: "2024-13-45" })).toEqual({ error: expect.stringContaining("to") });
    expect(parseDateRange({ to: ["2024-01-01"] })).toEqual({ error: expect.stringContaining("to") });
  });

  it("rejects a from date after the to date", () => {
    expect(parseDateRange({ from: "2024-01-01", to: "2020-01-01" })).toEqual({
      error: "Query parameter from must not be after to",
    });
  });
});

describe("getMarketValueSeries", () => {
  let chain;

  beforeEach(() => {
    jest.resetAllMocks();
    chain = { sort: jest.fn(() => chain), lean: jest.fn().mockResolvedValue([{ date: new Date("2024-01-01"), value: 1 }]) };
    MarketValue.find.mockReturnValue(chain);
  });

  it("returns null when the player does not exist", async () => {
    Player.exists.mockResolvedValue(null);

    expect(await getMarketValueSeries("p1", { from: null, to: null })).toBeNull();
    expect(MarketValue.find).not.toHaveBeenCalled();
  });

  it("returns all values oldest first when there is no range", async () => {
    Player.exists.mockResolvedValue({ _id: "p1" });

    const series = await getMarketValueSeries("p1", { from: null, to: null });

    expect(series).toEqual([{ date: new Date("2024-01-01"), value: 1 }]);
    expect(MarketValue.find).toHaveBeenCalledWith({ player: "p1" }, { _id: 0, date: 1, value: 1 });
    expect(chain.sort).toHaveBeenCalledWith({ date: 1 });
  });

  it("filters on the given bounds", async () => {
    Player.exists.mockResolvedValue({ _id: "p1" });
    const from = new Date("2020-01-01");
    const to = new Date("2024-01-01");

    await getMarketValueSeries("p1", { from, to: null });
    expect(MarketValue.find.mock.calls[0][0]).toEqual({ player: "p1", date: { $gte: from } });

    await getMarketValueSeries("p1", { from: null, to });
    expect(MarketValue.find.mock.calls[1][0]).toEqual({ player: "p1", date: { $lte: to } });

    await getMarketValueSeries("p1", { from, to });
    expect(MarketValue.find.mock.calls[2][0]).toEqual({ player: "p1", date: { $gte: from, $lte: to } });
  });
});
