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
const { createIndex } = require("../../../src/services/inflation");
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

  it("judges each transfer for the selling club (Lacazette: formed at Lyon, sold 53M, bought back for free)", async () => {
    Player.exists.mockResolvedValue({ _id: "p1" });
    const ol = { _id: "ol", name: "Olympique Lyon" };
    const ars = { _id: "ars", name: "Arsenal" };
    const neom = { _id: "neom", name: "NEOM SC" };
    transferChain.lean.mockResolvedValue([
      { date: new Date("2017-07-05"), seller: ol, buyer: ars, price: 53000000 },
      { date: new Date("2022-07-01"), seller: ars, buyer: ol, price: 0 },
      { date: new Date("2025-07-03"), seller: ol, buyer: neom, price: 0 },
    ]);
    valuationLean.mockResolvedValue([
      { date: new Date("2017-06-01"), value: 40000000 },
      { date: new Date("2022-06-01"), value: 15000000 },
    ]);

    const result = await getPlayerTransferRoi("p1");

    expect(Transfer.find).toHaveBeenCalledWith({ player: "p1" });
    expect(transferChain.sort).toHaveBeenCalledWith({ date: 1 });
    expect(MarketValue.find).toHaveBeenCalledWith({ player: "p1" }, { date: 1, value: 1 });
    expect(result).toEqual([
      {
        date: new Date("2017-07-05"),
        fromClub: { id: "ol", name: "Olympique Lyon" },
        toClub: { id: "ars", name: "Arsenal" },
        isLoan: false,
        reserveTeamMove: false,
        fee: 53000000,
        sellerCost: 0,
        homegrown: true,
        loanFees: 0,
        marketValueAtSale: { value: 40000000, date: new Date("2017-06-01") },
        gain: 53000000,
        roiPercent: null,
        adjusted: expect.any(Object),
      },
      {
        date: new Date("2022-07-01"),
        fromClub: { id: "ars", name: "Arsenal" },
        toClub: { id: "ol", name: "Olympique Lyon" },
        isLoan: false,
        reserveTeamMove: false,
        fee: 0,
        sellerCost: 53000000,
        homegrown: false,
        loanFees: 0,
        marketValueAtSale: { value: 15000000, date: new Date("2022-06-01") },
        gain: -53000000,
        roiPercent: -100,
        adjusted: expect.any(Object),
      },
      {
        date: new Date("2025-07-03"),
        fromClub: { id: "ol", name: "Olympique Lyon" },
        toClub: { id: "neom", name: "NEOM SC" },
        isLoan: false,
        reserveTeamMove: false,
        fee: 0,
        sellerCost: 0,
        homegrown: false,
        loanFees: 0,
        marketValueAtSale: { value: 15000000, date: new Date("2022-06-01") },
        gain: 0,
        roiPercent: null,
        adjusted: expect.any(Object),
      },
    ]);
  });

  it("adds the seller's loan fees to its sale, flags the loan and leaves out the return (bought 10M, loaned for 3M, sold 10M)", async () => {
    Player.exists.mockResolvedValue({ _id: "p1" });
    const ol = { _id: "ol", name: "OL" };
    const eve = { _id: "eve", name: "Everton" };
    transferChain.lean.mockResolvedValue([
      { date: new Date("2021-07-01"), seller: { _id: "g", name: "Gent" }, buyer: ol, price: 10000000 },
      { date: new Date("2022-07-01"), seller: ol, buyer: eve, price: 3000000 },
      { date: new Date("2023-06-30"), seller: eve, buyer: ol, price: 0 },
      { date: new Date("2023-08-01"), seller: ol, buyer: { _id: "rom", name: "Roma" }, price: 12000000 },
    ]);
    valuationLean.mockResolvedValue([]);

    const result = await getPlayerTransferRoi("p1");

    expect(result.map((r) => [r.toClub.name, r.isLoan])).toEqual([
      ["OL", false],
      ["Everton", true],
      ["Roma", false],
    ]);
    // Gent formed him as far as the dataset knows
    expect(result[0]).toMatchObject({ sellerCost: 0, homegrown: true, gain: 10000000 });
    expect(result[1]).toMatchObject({ fee: 3000000, sellerCost: null, gain: null, roiPercent: null });
    expect(result[2]).toMatchObject({ sellerCost: 10000000, loanFees: 3000000, gain: 5000000, roiPercent: 50 });
  });

  it("takes an unknown fee from a reserve team to its first team as 0", async () => {
    Player.exists.mockResolvedValue({ _id: "p1" });
    transferChain.lean.mockResolvedValue([
      { date: new Date("2018-07-01"), seller: { _id: "omb", name: "Olympique Marseille B" }, buyer: { _id: "om", name: "Olympique de Marseille" } },
    ]);
    valuationLean.mockResolvedValue([]);

    const [row] = await getPlayerTransferRoi("p1");

    expect(row).toMatchObject({ reserveTeamMove: true, fee: 0, sellerCost: 0, homegrown: true, gain: 0 });
  });

  it("has no gain when the move has no selling club or the seller's fee is unknown", async () => {
    Player.exists.mockResolvedValue({ _id: "p1" });
    const ol = { _id: "ol", name: "OL" };
    transferChain.lean.mockResolvedValue([
      { date: new Date("2015-07-01"), seller: null, buyer: ol, price: 0 },
      { date: new Date("2016-07-01"), seller: ol, buyer: { _id: "x", name: "X" } },
      { date: new Date("2018-07-01"), seller: { _id: "x", name: "X" }, buyer: { _id: "y", name: "Y" }, price: 5000000 },
    ]);
    valuationLean.mockResolvedValue([]);

    const result = await getPlayerTransferRoi("p1");

    expect(result.map((r) => [r.sellerCost, r.gain])).toEqual([
      [null, null],
      [0, null],
      [null, null],
    ]);
  });

  it("adds the seller's gain in money of the reference year", async () => {
    Player.exists.mockResolvedValue({ _id: "p1" });
    const index = createIndex({ name: "test", values: { 2020: 100, 2026: 140 } });
    transferChain.lean.mockResolvedValue([
      { date: new Date("2020-07-01"), seller: { _id: "x", name: "Other FC" }, buyer: { _id: "ol", name: "OL" }, price: 10000000 },
      { date: new Date("2026-07-01"), seller: { _id: "ol", name: "OL" }, buyer: { _id: "rom", name: "Roma" }, price: 14000000 },
    ]);
    valuationLean.mockResolvedValue([]);

    const rows = await getPlayerTransferRoi("p1", { inflation: { index, referenceYear: 2026 } });

    expect(rows[1]).toMatchObject({
      gain: 4000000,
      adjusted: { fee: 14000000, sellerCost: 14000000, gain: 0, roiPercent: 0 },
    });
  });

  it("returns an empty list for a player without transfers", async () => {
    Player.exists.mockResolvedValue({ _id: "p1" });
    transferChain.lean.mockResolvedValue([]);
    valuationLean.mockResolvedValue([]);

    expect(await getPlayerTransferRoi("p1")).toEqual([]);
  });
});
