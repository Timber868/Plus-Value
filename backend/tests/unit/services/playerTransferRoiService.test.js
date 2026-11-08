/**
 * @file Unit tests for a player's transfer ROI list with mocked models.
 */

jest.mock("../../../src/models/Player", () => ({ exists: jest.fn() }));
jest.mock("../../../src/models/Transfer", () => ({ find: jest.fn() }));
jest.mock("../../../src/models/MarketValue", () => ({ find: jest.fn() }));
jest.mock("../../../src/services/marketValueCutoff", () => {
  const actual = jest.requireActual("../../../src/services/marketValueCutoff");
  return { ...actual, getCurrentValueCutoff: jest.fn() };
});

const Player = require("../../../src/models/Player");
const Transfer = require("../../../src/models/Transfer");
const MarketValue = require("../../../src/models/MarketValue");
const { getCurrentValueCutoff } = require("../../../src/services/marketValueCutoff");
const { getPlayerTransferRoi } = require("../../../src/services/playerTransferRoiService");

describe("getPlayerTransferRoi", () => {
  let transferChain;
  let valuationLean;

  beforeEach(() => {
    jest.resetAllMocks();
    transferChain = { sort: jest.fn(() => transferChain), populate: jest.fn(() => transferChain), lean: jest.fn() };
    valuationLean = jest.fn();
    Transfer.find.mockReturnValue(transferChain);
    MarketValue.find.mockReturnValue({ lean: valuationLean });
    getCurrentValueCutoff.mockResolvedValue(new Date("2024-01-01"));
  });

  it("returns null when the player does not exist", async () => {
    Player.exists.mockResolvedValue(null);

    expect(await getPlayerTransferRoi("p1")).toBeNull();
    expect(Transfer.find).not.toHaveBeenCalled();
  });

  it("uses the next transfer as the exit and the current value for the latest one", async () => {
    Player.exists.mockResolvedValue({ _id: "p1" });
    transferChain.lean.mockResolvedValue([
      { date: new Date("2010-07-01"), seller: null, buyer: { _id: "ol", name: "OL" }, price: 0 },
      { date: new Date("2017-07-05"), seller: { _id: "ol", name: "OL" }, buyer: { _id: "ars", name: "Arsenal" }, price: 53000000 },
      { date: new Date("2022-07-01"), seller: { _id: "ars", name: "Arsenal" }, buyer: { _id: "ol", name: "OL" } },
    ]);
    valuationLean.mockResolvedValue([
      { date: new Date("2010-06-01"), value: 1000000 },
      { date: new Date("2017-06-01"), value: 40000000 },
      { date: new Date("2024-06-01"), value: 5000000 },
    ]);

    const result = await getPlayerTransferRoi("p1");

    expect(Transfer.find).toHaveBeenCalledWith({ player: "p1" });
    expect(transferChain.sort).toHaveBeenCalledWith({ date: 1 });
    expect(MarketValue.find).toHaveBeenCalledWith({ player: "p1" }, { date: 1, value: 1 });
    expect(result).toEqual([
      {
        date: new Date("2010-07-01"),
        fromClub: null,
        toClub: { id: "ol", name: "OL" },
        isLoan: false,
        feePaid: 0,
        marketValueAtSigning: { value: 1000000, date: new Date("2010-06-01") },
        exit: { type: "resale", value: 53000000, date: new Date("2017-07-05"), loanFees: 0 },
        gain: 53000000,
        roiPercent: null,
      },
      {
        date: new Date("2017-07-05"),
        fromClub: { id: "ol", name: "OL" },
        toClub: { id: "ars", name: "Arsenal" },
        isLoan: false,
        feePaid: 53000000,
        marketValueAtSigning: { value: 40000000, date: new Date("2017-06-01") },
        exit: { type: "resale", value: null, date: new Date("2022-07-01"), loanFees: 0 },
        gain: null,
        roiPercent: null,
      },
      {
        date: new Date("2022-07-01"),
        fromClub: { id: "ars", name: "Arsenal" },
        toClub: { id: "ol", name: "OL" },
        isLoan: false,
        feePaid: null,
        marketValueAtSigning: { value: 40000000, date: new Date("2017-06-01") },
        exit: { type: "marketValue", value: 5000000, date: new Date("2024-06-01"), loanFees: 0 },
        gain: null,
        roiPercent: null,
      },
    ]);
  });

  it("adds loan fees to the resale, flags the loan and leaves out the return (bought 10M, loaned for 3M, sold 10M)", async () => {
    Player.exists.mockResolvedValue({ _id: "p1" });
    const ol = { _id: "ol", name: "OL" };
    const eve = { _id: "eve", name: "Everton" };
    transferChain.lean.mockResolvedValue([
      { date: new Date("2021-07-01"), seller: { _id: "g", name: "Gent" }, buyer: ol, price: 10000000 },
      { date: new Date("2022-07-01"), seller: ol, buyer: eve, price: 3000000 },
      { date: new Date("2023-06-30"), seller: eve, buyer: ol, price: 0 },
      { date: new Date("2023-08-01"), seller: ol, buyer: { _id: "rom", name: "Roma" }, price: 10000000 },
    ]);
    valuationLean.mockResolvedValue([]);

    const result = await getPlayerTransferRoi("p1");

    expect(result.map((r) => [r.toClub.name, r.isLoan])).toEqual([
      ["OL", false],
      ["Everton", true],
      ["Roma", false],
    ]);
    expect(result[0]).toMatchObject({ exit: { type: "resale", value: 13000000, loanFees: 3000000 }, gain: 3000000, roiPercent: 30 });
    expect(result[1]).toMatchObject({ feePaid: 3000000, exit: { type: "resale", value: 0 }, gain: -3000000 });
  });

  it("returns an empty list for a player without transfers", async () => {
    Player.exists.mockResolvedValue({ _id: "p1" });
    transferChain.lean.mockResolvedValue([]);
    valuationLean.mockResolvedValue([]);

    expect(await getPlayerTransferRoi("p1")).toEqual([]);
  });
});
