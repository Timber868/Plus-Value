/**
 * @file Unit tests for the squad value of a club and season. The pure squad
 * rules are tested directly; getSquadValue runs against mocked models here
 * and against an in-memory MongoDB in squadValueService.db.test.js.
 */

jest.mock("../../../src/models/Club", () => ({ findById: jest.fn() }));
jest.mock("../../../src/models/Season", () => ({ findById: jest.fn(), find: jest.fn() }));
jest.mock("../../../src/models/ClubSeason", () => ({ distinct: jest.fn() }));
jest.mock("../../../src/models/Player", () => ({ find: jest.fn() }));
jest.mock("../../../src/models/Transfer", () => ({ distinct: jest.fn(), find: jest.fn() }));
jest.mock("../../../src/models/MarketValue", () => ({ findOne: jest.fn(), find: jest.fn() }));

const Club = require("../../../src/models/Club");
const Season = require("../../../src/models/Season");
const ClubSeason = require("../../../src/models/ClubSeason");
const Player = require("../../../src/models/Player");
const Transfer = require("../../../src/models/Transfer");
const MarketValue = require("../../../src/models/MarketValue");
const { computeSquad, getSquadValue, getSquadValueHistory } = require("../../../src/services/squadValueService");

const d = (s) => new Date(s);
const lean = (value) => ({ lean: jest.fn().mockResolvedValue(value) });
/** A query with populate() calls before lean(), like the transfer query */
const populated = (value) => {
  const query = { lean: jest.fn().mockResolvedValue(value) };
  query.populate = jest.fn(() => query);
  return query;
};

describe("computeSquad", () => {
  const players = [
    { _id: "gk", position: "Goalkeeper", person: { name: "Lucas Perri" } },
    { _id: "fw", position: "Attack", subPosition: "Centre-Forward", person: { name: "Alexandre Lacazette" } },
    { _id: "mid", position: "Midfield", person: { name: "Corentin Tolisso" } },
    { _id: "gone", position: "Attack", person: { name: "Rayan Cherki" } },
    { _id: "old", position: null, person: { name: "Vieux Joueur" } },
  ];
  const transfers = [
    { player: "gk", date: d("2024-07-01"), buyer: "ol" },
    { player: "fw", date: d("2017-07-05"), buyer: "ars" },
    { player: "fw", date: d("2022-07-01"), buyer: "ol" },
    { player: "mid", date: d("2020-07-01"), buyer: "ol" },
    // Left before the season ended
    { player: "gone", date: d("2019-07-01"), buyer: "ol" },
    { player: "gone", date: d("2025-01-15"), buyer: "mci" },
    { player: "old", date: d("2015-07-01"), buyer: "ol" },
    // A move after the season's end does not count
    { player: "mid", date: d("2025-07-10"), buyer: "rom" },
  ];
  const valuations = [
    { player: "gk", date: d("2025-03-01"), value: 12000000 },
    { player: "fw", date: d("2024-12-01"), value: 4000000 },
    { player: "fw", date: d("2025-06-30"), value: 9999 }, // after the reference date
    { player: "mid", date: d("2025-01-01"), value: 6000000 },
    { player: "old", date: d("2019-01-01"), value: 1000000 }, // too old to count
  ];

  const result = computeSquad({
    clubId: "ol",
    squadDate: d("2025-05-31"),
    referenceDate: d("2025-05-31"),
    transfers,
    valuations: valuations.filter((v) => v.date <= d("2025-05-31")),
    players,
  });

  it("keeps the players whose latest transfer before the season's end is to the club", () => {
    expect(result.players.map((p) => p.id)).toEqual(["gk", "mid", "fw", "old"]);
  });

  it("values each player at the reference date and drops values older than one market window", () => {
    expect(result.players.find((p) => p.id === "fw")).toEqual({
      id: "fw",
      name: "Alexandre Lacazette",
      position: "Attack",
      subPosition: "Centre-Forward",
      marketValue: { value: 4000000, date: d("2024-12-01") },
      joinedAt: d("2022-07-01"),
      joinedOnLoan: false,
      feePaid: null,
      gainSinceJoining: null,
      contractExpiresAt: null,
    });
    expect(result.players.find((p) => p.id === "old").marketValue).toBeNull();
  });

  it("gives each player's arrival, fee, gain since joining and contract end, skipping a loan return", () => {
    const squad = computeSquad({
      clubId: "ol",
      squadDate: d("2025-05-31"),
      referenceDate: d("2025-05-31"),
      transfers: [
        // Bought for 10M, loaned out and back: the arrival is still the purchase
        { player: "a", date: d("2022-07-01"), buyer: "ol", seller: "x", fee: 10000000 },
        { player: "a", date: d("2023-08-01"), buyer: "y", seller: "ol", fee: 0 },
        { player: "a", date: d("2024-06-30"), buyer: "ol", seller: "y", fee: 0 },
        // On loan at the club: no gain
        { player: "b", date: d("2024-09-01"), buyer: "ol", seller: "z", fee: 1000000 },
        { player: "b", date: d("2025-06-30"), buyer: "z", seller: "ol", fee: 0 },
      ],
      valuations: [
        { player: "a", date: d("2025-03-01"), value: 25000000 },
        { player: "b", date: d("2025-03-01"), value: 8000000 },
      ],
      players: [
        { _id: "a", position: "Attack", person: { name: "A" }, contractExpiresAt: d("2028-06-30") },
        { _id: "b", position: "Defender", person: { name: "B" } },
      ],
    });
    expect(squad.players.find((p) => p.id === "a")).toMatchObject({
      joinedAt: d("2022-07-01"),
      joinedOnLoan: false,
      feePaid: 10000000,
      gainSinceJoining: 15000000,
      contractExpiresAt: d("2028-06-30"),
    });
    expect(squad.players.find((p) => p.id === "b")).toMatchObject({ joinedOnLoan: true, feePaid: 1000000, gainSinceJoining: null });
  });

  it("keeps a player sold with a loan back on the same day, whatever the stored order", () => {
    // Malo Gusto: Lyon to Chelsea for 30M and back to Lyon on loan the same day, the sale row stored first
    const squad = computeSquad({
      clubId: "ol",
      squadDate: d("2023-06-03"),
      referenceDate: d("2023-06-03"),
      transfers: [
        { player: "g", date: d("2023-01-20"), buyer: "che", seller: "ol", fee: 30000000 },
        { player: "g", date: d("2023-01-20"), buyer: "ol", seller: "che", fee: 0 },
        { player: "g", date: d("2023-07-01"), buyer: "che", seller: "ol", fee: 0 },
      ],
      valuations: [{ player: "g", date: d("2023-03-01"), value: 25000000 }],
      players: [{ _id: "g", position: "Defender", person: { name: "Malo Gusto" } }],
    });
    expect(squad.players.map((p) => p.id)).toEqual(["g"]);
    expect(squad.players[0]).toMatchObject({ joinedAt: d("2023-01-20"), joinedOnLoan: true, gainSinceJoining: null });
    expect(squad.totals.totalValue).toBe(25000000);
  });

  it("adds the loan fee to the fee paid when a purchase converts a loan", () => {
    const squad = computeSquad({
      clubId: "ol",
      squadDate: d("2025-05-31"),
      referenceDate: d("2025-05-31"),
      transfers: [
        { player: "c", date: d("2024-01-15"), buyer: "ol", seller: "x", fee: 2000000 },
        { player: "c", date: d("2024-07-01"), buyer: "ol", seller: "x", fee: 20000000 },
      ],
      valuations: [{ player: "c", date: d("2025-03-01"), value: 30000000 }],
      players: [{ _id: "c", position: "Attack", person: { name: "C" } }],
    });
    expect(squad.players[0]).toMatchObject({ joinedAt: d("2024-07-01"), feePaid: 22000000, gainSinceJoining: 8000000 });
  });

  it("returns totals and totals per position, unknown positions last", () => {
    expect(result.totals).toEqual({
      totalValue: 22000000,
      playerCount: 4,
      valuedPlayerCount: 3,
      byPosition: [
        { position: "Goalkeeper", playerCount: 1, totalValue: 12000000 },
        { position: "Midfield", playerCount: 1, totalValue: 6000000 },
        { position: "Attack", playerCount: 1, totalValue: 4000000 },
        { position: null, playerCount: 1, totalValue: 0 },
      ],
    });
  });
});

describe("getSquadValue", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    Club.findById.mockReturnValue(lean({ _id: "ol", name: "Olympique Lyonnais" }));
    Season.findById.mockReturnValue(lean({ _id: "s25", period: "2025/2026", startDate: d("2025-08-15"), endDate: d("2026-05-16") }));
    MarketValue.findOne.mockReturnValue({ sort: jest.fn(() => lean({ date: d("2025-12-18") })) });
    Transfer.distinct.mockResolvedValue(["fw"]);
    Transfer.find.mockReturnValue(populated([{ player: "fw", date: d("2022-07-01"), buyer: { _id: "ol", name: "Olympique Lyonnais" }, price: 0 }]));
    MarketValue.find.mockReturnValue(lean([{ player: "fw", date: d("2025-12-18"), value: 3500000 }]));
    Player.find.mockReturnValue({ populate: jest.fn(() => lean([{ _id: "fw", position: "Attack", person: { name: "Alexandre Lacazette" } }])) });
  });

  it("returns null for an unknown club or season", async () => {
    Club.findById.mockReturnValue(lean(null));
    expect(await getSquadValue("x", "s25")).toBeNull();

    Club.findById.mockReturnValue(lean({ _id: "ol", name: "Olympique Lyonnais" }));
    Season.findById.mockReturnValue(lean(null));
    expect(await getSquadValue("ol", "x")).toBeNull();
  });

  it("uses the newest valuation as the reference date while the season is not over", async () => {
    const result = await getSquadValue("ol", "s25");

    expect(Transfer.distinct).toHaveBeenCalledWith("player", { buyer: "ol", date: { $lte: d("2026-05-16") } });
    expect(MarketValue.find).toHaveBeenCalledWith(
      { player: { $in: ["fw"] }, date: { $lte: d("2026-05-16") } },
      { player: 1, date: 1, value: 1 },
    );
    expect(result).toMatchObject({
      club: { id: "ol", name: "Olympique Lyonnais" },
      season: { id: "s25", period: "2025/2026" },
      referenceDate: d("2025-12-18"),
      totals: { totalValue: 3500000, playerCount: 1 },
    });
  });

  it("uses the season's end date for a finished season", async () => {
    Season.findById.mockReturnValue(lean({ _id: "s23", period: "2023/2024", startDate: d("2023-08-11"), endDate: d("2024-05-19") }));

    const result = await getSquadValue("ol", "s23");

    expect(result.referenceDate).toEqual(d("2024-05-19"));
  });
});

describe("getSquadValueHistory", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    Club.findById.mockReturnValue(lean({ _id: "ol", name: "Olympique Lyonnais" }));
    MarketValue.findOne.mockReturnValue({ sort: jest.fn(() => lean({ date: d("2025-12-18") })) });
  });

  it("returns null for an unknown club", async () => {
    Club.findById.mockReturnValue(lean(null));
    expect(await getSquadValueHistory("x")).toBeNull();
  });

  it("returns the total squad value of each season the club played, oldest first", async () => {
    ClubSeason.distinct.mockResolvedValue(["s24", "s25"]);
    const seasonsChain = {
      sort: jest.fn(() => seasonsChain),
      lean: jest.fn().mockResolvedValue([
        { _id: "s24", period: "2024/2025", startDate: d("2024-08-16"), endDate: d("2025-05-17") },
        { _id: "s25", period: "2025/2026", startDate: d("2025-08-15"), endDate: d("2026-05-16") },
      ]),
    };
    Season.find.mockReturnValue(seasonsChain);
    Transfer.distinct.mockResolvedValue(["fw", "mid"]);
    Transfer.find.mockReturnValue(
      populated([
        { player: "fw", date: d("2022-07-01"), buyer: "ol" },
        { player: "mid", date: d("2025-07-01"), buyer: "ol" },
      ]),
    );
    MarketValue.find.mockReturnValue(
      lean([
        { player: "fw", date: d("2025-03-01"), value: 4000000 },
        { player: "fw", date: d("2025-12-01"), value: 3000000 },
        { player: "mid", date: d("2025-12-01"), value: 10000000 },
      ]),
    );
    Player.find.mockReturnValue({
      populate: jest.fn(() => lean([{ _id: "fw", position: "Attack" }, { _id: "mid", position: "Midfield" }])),
    });

    const result = await getSquadValueHistory("ol");

    expect(ClubSeason.distinct).toHaveBeenCalledWith("season", { club: "ol" });
    expect(seasonsChain.sort).toHaveBeenCalledWith({ startDate: 1 });
    // One load for every season, up to the last season's end
    expect(Transfer.distinct).toHaveBeenCalledTimes(1);
    expect(Transfer.distinct).toHaveBeenCalledWith("player", { buyer: "ol", date: { $lte: d("2026-05-16") } });
    expect(result).toEqual({
      club: { id: "ol", name: "Olympique Lyonnais" },
      seasons: [
        { season: { id: "s24", period: "2024/2025" }, referenceDate: d("2025-05-17"), totalValue: 4000000, playerCount: 1, valuedPlayerCount: 1 },
        { season: { id: "s25", period: "2025/2026" }, referenceDate: d("2025-12-18"), totalValue: 13000000, playerCount: 2, valuedPlayerCount: 2 },
      ],
    });
  });

  it("returns no seasons for a club without any", async () => {
    ClubSeason.distinct.mockResolvedValue([]);
    const seasonsChain = { sort: jest.fn(() => seasonsChain), lean: jest.fn().mockResolvedValue([]) };
    Season.find.mockReturnValue(seasonsChain);

    expect(await getSquadValueHistory("ol")).toEqual({ club: { id: "ol", name: "Olympique Lyonnais" }, seasons: [] });
    expect(Transfer.distinct).not.toHaveBeenCalled();
  });
});
