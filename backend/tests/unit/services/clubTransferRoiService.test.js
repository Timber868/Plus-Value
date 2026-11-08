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

    expect(totals).toEqual({ totalSpent: 19, totalCurrentValue: 10, totalResaleIncome: 30, totalLoanIncome: 0, netGain: 17 });
  });

  it("reports loan fees apart from resale fees and valuations", () => {
    const totals = computeTotals([
      { feePaid: 10, exit: { type: "resale", value: 13, loanFees: 3 }, gain: 3 },
      { feePaid: 5, exit: { type: "marketValue", value: 7, loanFees: 1 }, gain: 2 },
      { feePaid: 4, exit: { type: "resale", value: null, loanFees: 2 }, gain: null },
    ]);

    expect(totals).toEqual({ totalSpent: 19, totalCurrentValue: 6, totalResaleIncome: 10, totalLoanIncome: 6, netGain: 5 });
  });

  it("returns zeros for no transfers", () => {
    expect(computeTotals([])).toEqual({
      totalSpent: 0,
      totalCurrentValue: 0,
      totalResaleIncome: 0,
      totalLoanIncome: 0,
      netGain: 0,
    });
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
      { player: lacazette, buyer: "ol", seller: null, date: new Date("2010-07-01"), price: 0 },
      { player: tolisso, buyer: "ol", seller: { _id: "x", name: "Other FC" }, date: new Date("2022-07-01"), price: 10000000 },
    ]);
    transferLean.mockResolvedValue([
      { player: "p1", date: new Date("2010-07-01"), price: 0, buyer: "ol", seller: null },
      { player: "p1", date: new Date("2017-07-05"), price: 53000000, buyer: "ars", seller: "ol" },
      { player: "p2", date: new Date("2022-07-01"), price: 10000000, buyer: "ol", seller: "x" },
    ]);
    valuationLean.mockResolvedValue([
      { player: "p1", date: new Date("2010-06-01"), value: 1000000 },
      { player: "p2", date: new Date("2022-06-01"), value: 12000000 },
      { player: "p2", date: new Date("2024-06-01"), value: 4000000 },
    ]);

    const result = await getClubTransferRoi("ol");

    expect(Transfer.find).toHaveBeenNthCalledWith(1, { buyer: "ol" });
    expect(incomingChain.sort).toHaveBeenCalledWith({ date: 1 });
    expect(Transfer.find).toHaveBeenNthCalledWith(2, { player: { $in: ["p1", "p2"] } }, { player: 1, date: 1, price: 1, buyer: 1, seller: 1 });
    expect(result.transfers).toEqual([
      {
        player: { id: "p1", name: "Alexandre Lacazette" },
        date: new Date("2010-07-01"),
        fromClub: null,
        isLoan: false,
        feePaid: 0,
        marketValueAtSigning: { value: 1000000, date: new Date("2010-06-01") },
        exit: { type: "resale", value: 53000000, date: new Date("2017-07-05"), loanFees: 0 },
        gain: 53000000,
        roiPercent: null,
      },
      {
        player: { id: "p2", name: "Corentin Tolisso" },
        date: new Date("2022-07-01"),
        fromClub: { id: "x", name: "Other FC" },
        isLoan: false,
        feePaid: 10000000,
        marketValueAtSigning: { value: 12000000, date: new Date("2022-06-01") },
        exit: { type: "marketValue", value: 4000000, date: new Date("2024-06-01"), loanFees: 0 },
        gain: -6000000,
        roiPercent: -60,
      },
    ]);
    expect(result.totals).toEqual({
      totalSpent: 10000000,
      totalCurrentValue: 4000000,
      totalResaleIncome: 53000000,
      totalLoanIncome: 0,
      netGain: 47000000,
    });
  });

  it("leaves out loan returns and adds loan fees to the resale (bought 10M, loaned for 3M, sold 10M)", async () => {
    Club.exists.mockResolvedValue({ _id: "ol" });
    const everton = { _id: "eve", name: "Everton" };
    incomingChain.lean.mockResolvedValue([
      { player: tolisso, buyer: "ol", seller: { _id: "x", name: "Other FC" }, date: new Date("2021-07-01"), price: 10000000 },
      { player: tolisso, buyer: "ol", seller: everton, date: new Date("2023-06-30"), price: 0 },
    ]);
    transferLean.mockResolvedValue([
      { player: "p2", date: new Date("2021-07-01"), price: 10000000, buyer: "ol", seller: "x" },
      { player: "p2", date: new Date("2022-07-01"), price: 3000000, buyer: "eve", seller: "ol" },
      { player: "p2", date: new Date("2023-06-30"), price: 0, buyer: "ol", seller: "eve" },
      { player: "p2", date: new Date("2023-08-01"), price: 10000000, buyer: "rom", seller: "ol" },
    ]);
    valuationLean.mockResolvedValue([]);

    const result = await getClubTransferRoi("ol");

    expect(result.transfers).toHaveLength(1);
    expect(result.transfers[0]).toMatchObject({
      date: new Date("2021-07-01"),
      isLoan: false,
      exit: { type: "resale", value: 13000000, loanFees: 3000000 },
      gain: 3000000,
      roiPercent: 30,
    });
    expect(result.totals).toMatchObject({ totalResaleIncome: 10000000, totalLoanIncome: 3000000, netGain: 3000000 });
  });

  it("flags a player the club took on loan", async () => {
    Club.exists.mockResolvedValue({ _id: "ol" });
    incomingChain.lean.mockResolvedValue([
      { player: tolisso, buyer: "ol", seller: { _id: "x", name: "Other FC" }, date: new Date("2022-08-01"), price: 1000000 },
    ]);
    transferLean.mockResolvedValue([
      { player: "p2", date: new Date("2022-08-01"), price: 1000000, buyer: "ol", seller: "x" },
      { player: "p2", date: new Date("2023-06-30"), price: 0, buyer: "x", seller: "ol" },
    ]);
    valuationLean.mockResolvedValue([]);

    const result = await getClubTransferRoi("ol");

    expect(result.transfers[0]).toMatchObject({ isLoan: true, exit: { type: "resale", value: 0 }, gain: -1000000 });
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
      totals: { totalSpent: 0, totalCurrentValue: 0, totalResaleIncome: 0, totalLoanIncome: 0, netGain: 0 },
    });
  });
});
