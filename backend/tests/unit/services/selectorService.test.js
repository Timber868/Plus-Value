/**
 * @file Unit tests for the club and season picker lists with mocked models.
 */

jest.mock("../../../src/models/Club", () => ({ find: jest.fn() }));
jest.mock("../../../src/models/ClubSeason", () => ({ distinct: jest.fn() }));
jest.mock("../../../src/models/League", () => ({ findOne: jest.fn(), find: jest.fn() }));
jest.mock("../../../src/models/Season", () => ({ find: jest.fn(), distinct: jest.fn() }));

const Club = require("../../../src/models/Club");
const ClubSeason = require("../../../src/models/ClubSeason");
const League = require("../../../src/models/League");
const Season = require("../../../src/models/Season");
const { listClubs, listSeasons, listLeagues } = require("../../../src/services/selectorService");

function chain(result) {
  const c = { sort: jest.fn(() => c), populate: jest.fn(() => c), lean: jest.fn().mockResolvedValue(result) };
  return c;
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe("listClubs", () => {
  it("returns the non-external clubs sorted by name", async () => {
    const clubs = chain([{ _id: "c1", name: "AS Monaco", country: "Monaco" }]);
    Club.find.mockReturnValue(clubs);

    const result = await listClubs();

    expect(Club.find).toHaveBeenCalledWith({ isExternal: { $ne: true } }, { name: 1, country: 1 });
    expect(clubs.sort).toHaveBeenCalledWith({ name: 1 });
    expect(result).toEqual([{ id: "c1", name: "AS Monaco", country: "Monaco" }]);
  });

  it("limits the clubs to those with a season in the league", async () => {
    League.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: "fr1" }) });
    Season.distinct.mockResolvedValue(["s1", "s2"]);
    ClubSeason.distinct.mockResolvedValue(["c1"]);
    Club.find.mockReturnValue(chain([{ _id: "c1", name: "Olympique Lyonnais", country: "France" }]));

    const result = await listClubs({ league: "FR1" });

    expect(League.findOne).toHaveBeenCalledWith({ competitionId: "FR1" }, { _id: 1 });
    expect(Season.distinct).toHaveBeenCalledWith("_id", { league: "fr1" });
    expect(ClubSeason.distinct).toHaveBeenCalledWith("club", { season: { $in: ["s1", "s2"] } });
    expect(Club.find).toHaveBeenCalledWith({ _id: { $in: ["c1"] } }, { name: 1, country: 1 });
    expect(result).toEqual([{ id: "c1", name: "Olympique Lyonnais", country: "France" }]);
  });

  it("returns an empty list for an unknown league", async () => {
    League.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

    expect(await listClubs({ league: "XX1" })).toEqual([]);
    expect(Club.find).not.toHaveBeenCalled();
  });
});

describe("listSeasons", () => {
  const start = new Date("2024-08-01");
  const end = new Date("2025-05-31");

  it("returns every season newest first with its league code", async () => {
    const seasons = chain([{ _id: "s1", period: "2024/2025", startDate: start, endDate: end, league: { competitionId: "FR1" } }]);
    Season.find.mockReturnValue(seasons);

    const result = await listSeasons();

    expect(Season.find).toHaveBeenCalledWith({}, { period: 1, startDate: 1, endDate: 1, league: 1 });
    expect(seasons.sort).toHaveBeenCalledWith({ startDate: -1 });
    expect(seasons.populate).toHaveBeenCalledWith("league", "competitionId");
    expect(result).toEqual([{ id: "s1", period: "2024/2025", startDate: start, endDate: end, league: "FR1" }]);
  });

  it("filters by league", async () => {
    League.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue({ _id: "fr1" }) });
    Season.find.mockReturnValue(chain([]));

    await listSeasons({ league: "FR1" });

    expect(Season.find).toHaveBeenCalledWith({ league: "fr1" }, expect.any(Object));
  });

  it("returns an empty list for an unknown league", async () => {
    League.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

    expect(await listSeasons({ league: "XX1" })).toEqual([]);
    expect(Season.find).not.toHaveBeenCalled();
  });
});

describe("listLeagues", () => {
  it("returns the leagues with seasons, by tier then name", async () => {
    Season.distinct.mockResolvedValue(["l1", "l2", "l3"]);
    League.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { competitionId: "FR2", name: "Ligue 2", country: "France", tier: 2 },
        { competitionId: "XX", name: "Autre ligue" },
        { competitionId: "FR1", name: "Ligue 1", country: "France", tier: 1 },
      ]),
    });

    const result = await listLeagues();

    expect(Season.distinct).toHaveBeenCalledWith("league");
    expect(League.find).toHaveBeenCalledWith(
      { _id: { $in: ["l1", "l2", "l3"] }, competitionFormat: "league" },
      { competitionId: 1, name: 1, country: 1, tier: 1 },
    );
    expect(result).toEqual([
      { id: "FR1", name: "Ligue 1", country: "France", tier: 1 },
      { id: "FR2", name: "Ligue 2", country: "France", tier: 2 },
      { id: "XX", name: "Autre ligue", country: null, tier: null },
    ]);
  });
});
