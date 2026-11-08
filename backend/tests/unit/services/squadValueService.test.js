/**
 * @file Unit tests for the squad value of a club and season. The pure squad
 * rules are tested directly; getSquadValue runs against mocked models here
 * and against an in-memory MongoDB in squadValueService.db.test.js.
 */

jest.mock("../../../src/models/Club", () => ({ findById: jest.fn() }));
jest.mock("../../../src/models/Season", () => ({ findById: jest.fn() }));
jest.mock("../../../src/models/Player", () => ({ find: jest.fn() }));
jest.mock("../../../src/models/Transfer", () => ({ distinct: jest.fn(), find: jest.fn() }));
jest.mock("../../../src/models/MarketValue", () => ({ findOne: jest.fn(), find: jest.fn() }));

const Club = require("../../../src/models/Club");
const Season = require("../../../src/models/Season");
const Player = require("../../../src/models/Player");
const Transfer = require("../../../src/models/Transfer");
const MarketValue = require("../../../src/models/MarketValue");
const { computeSquad, getSquadValue } = require("../../../src/services/squadValueService");

const d = (s) => new Date(s);
const lean = (value) => ({ lean: jest.fn().mockResolvedValue(value) });

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
    });
    expect(result.players.find((p) => p.id === "old").marketValue).toBeNull();
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
    Transfer.find.mockReturnValue(lean([{ player: "fw", date: d("2022-07-01"), buyer: "ol" }]));
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
      { player: { $in: ["fw"] }, date: { $lte: d("2025-12-18") } },
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
