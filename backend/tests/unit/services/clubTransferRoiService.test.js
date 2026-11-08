/**
 * @file Unit tests for a club's transfer ROI list with mocked models. The real
 * queries run against an in-memory MongoDB in clubTransferRoiService.db.test.js.
 */

jest.mock("../../../src/models/Club", () => ({ exists: jest.fn() }));
jest.mock("../../../src/models/Transfer", () => ({ find: jest.fn() }));
jest.mock("../../../src/models/MarketValue", () => ({ find: jest.fn() }));
jest.mock("../../../src/services/marketValueCutoff", () => {
  const actual = jest.requireActual("../../../src/services/marketValueCutoff");
  return { ...actual, getCurrentValueCutoff: jest.fn() };
});

const Club = require("../../../src/models/Club");
const Transfer = require("../../../src/models/Transfer");
const MarketValue = require("../../../src/models/MarketValue");
const { getCurrentValueCutoff } = require("../../../src/services/marketValueCutoff");
const { computeTotals, getClubTransferRoi } = require("../../../src/services/clubTransferRoiService");

const lacazette = { _id: "p1", person: { name: "Alexandre Lacazette" } };
const tolisso = { _id: "p2", person: { name: "Corentin Tolisso" } };

describe("computeTotals", () => {
  it("sums known amounts and skips unknown ones", () => {
    const totals = computeTotals([
      { feePaid: 10, exit: { type: "resale", value: 30 }, gain: 20 },
      { feePaid: 5, exit: { type: "marketValue", value: 2 }, gain: -3 },
      { feePaid: null, exit: { type: "marketValue", value: 8 }, gain: null },
      { feePaid: 4, exit: { type: "resale", value: null }, gain: null },
    ]);

    expect(totals).toEqual({ totalSpent: 19, totalCurrentValue: 10, totalResaleIncome: 30, netGain: 17 });
  });

  it("returns zeros for no transfers", () => {
    expect(computeTotals([])).toEqual({ totalSpent: 0, totalCurrentValue: 0, totalResaleIncome: 0, netGain: 0 });
  });
});

describe("getClubTransferRoi", () => {
  let incomingChain;
  let transferLean;
  let valuationLean;

  beforeEach(() => {
    jest.resetAllMocks();
    incomingChain = { sort: jest.fn(() => incomingChain), populate: jest.fn(() => incomingChain), lean: jest.fn() };
    transferLean = jest.fn();
    valuationLean = jest.fn();
    // First Transfer.find is the club's incoming transfers, the second loads the players' full histories
    Transfer.find.mockReturnValueOnce(incomingChain).mockReturnValueOnce({ lean: transferLean });
    MarketValue.find.mockReturnValue({ lean: valuationLean });
    getCurrentValueCutoff.mockResolvedValue(new Date("2024-01-01"));
  });

  it("returns null when the club does not exist", async () => {
    Club.exists.mockResolvedValue(null);

    expect(await getClubTransferRoi("ol")).toBeNull();
    expect(Transfer.find).not.toHaveBeenCalled();
  });

  it("returns each incoming transfer with its ROI and the club totals", async () => {
    Club.exists.mockResolvedValue({ _id: "ol" });
    incomingChain.lean.mockResolvedValue([
      { player: lacazette, seller: null, date: new Date("2010-07-01"), price: 0 },
      { player: tolisso, seller: { _id: "x", name: "Other FC" }, date: new Date("2022-07-01"), price: 10000000 },
    ]);
    transferLean.mockResolvedValue([
      { player: "p1", date: new Date("2010-07-01"), price: 0 },
      { player: "p1", date: new Date("2017-07-05"), price: 53000000 },
      { player: "p2", date: new Date("2022-07-01"), price: 10000000 },
    ]);
    valuationLean.mockResolvedValue([
      { player: "p1", date: new Date("2010-06-01"), value: 1000000 },
      { player: "p2", date: new Date("2022-06-01"), value: 12000000 },
      { player: "p2", date: new Date("2024-06-01"), value: 4000000 },
    ]);

    const result = await getClubTransferRoi("ol");

    expect(Transfer.find).toHaveBeenNthCalledWith(1, { buyer: "ol" });
    expect(incomingChain.sort).toHaveBeenCalledWith({ date: 1 });
    expect(Transfer.find).toHaveBeenNthCalledWith(2, { player: { $in: ["p1", "p2"] } }, { player: 1, date: 1, price: 1 });
    expect(result.transfers).toEqual([
      {
        player: { id: "p1", name: "Alexandre Lacazette" },
        date: new Date("2010-07-01"),
        fromClub: null,
        feePaid: 0,
        marketValueAtSigning: { value: 1000000, date: new Date("2010-06-01") },
        exit: { type: "resale", value: 53000000, date: new Date("2017-07-05") },
        gain: 53000000,
        roiPercent: null,
      },
      {
        player: { id: "p2", name: "Corentin Tolisso" },
        date: new Date("2022-07-01"),
        fromClub: { id: "x", name: "Other FC" },
        feePaid: 10000000,
        marketValueAtSigning: { value: 12000000, date: new Date("2022-06-01") },
        exit: { type: "marketValue", value: 4000000, date: new Date("2024-06-01") },
        gain: -6000000,
        roiPercent: -60,
      },
    ]);
    expect(result.totals).toEqual({
      totalSpent: 10000000,
      totalCurrentValue: 4000000,
      totalResaleIncome: 53000000,
      netGain: 47000000,
    });
  });

  it("filters by season when one is given", async () => {
    Club.exists.mockResolvedValue({ _id: "ol" });
    incomingChain.lean.mockResolvedValue([]);
    transferLean.mockResolvedValue([]);
    valuationLean.mockResolvedValue([]);

    const result = await getClubTransferRoi("ol", { seasonId: "s1" });

    expect(Transfer.find).toHaveBeenNthCalledWith(1, { buyer: "ol", season: "s1" });
    expect(result).toEqual({
      transfers: [],
      totals: { totalSpent: 0, totalCurrentValue: 0, totalResaleIncome: 0, netGain: 0 },
    });
  });
});
