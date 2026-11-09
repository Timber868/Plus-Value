/**
 * @file Runs the club and season picker queries against an in-memory MongoDB.
 * Like Club.test.js, this needs the MongoDB binary and is verified in CI.
 */

const mongo = require("../../helpers/mongoMemory");
const Club = require("../../../src/models/Club");
const ClubSeason = require("../../../src/models/ClubSeason");
const League = require("../../../src/models/League");
const Season = require("../../../src/models/Season");
const { listClubs, listSeasons } = require("../../../src/services/selectorService");

beforeAll(async () => {
  await mongo.start();
});

afterAll(async () => {
  await mongo.stop();
});

beforeEach(async () => {
  await mongo.clearAll();
  const fr1 = await League.create({ competitionId: "FR1", name: "Ligue 1", country: "France", confederation: "UEFA" });
  const gb1 = await League.create({ competitionId: "GB1", name: "Premier League", country: "England", confederation: "UEFA" });
  const fr2024 = await Season.create({ league: fr1._id, startDate: new Date("2024-08-16"), endDate: new Date("2025-05-17") });
  await Season.create({ league: fr1._id, startDate: new Date("2023-08-11"), endDate: new Date("2024-05-19") });
  const gb2024 = await Season.create({ league: gb1._id, startDate: new Date("2024-08-16"), endDate: new Date("2025-05-25") });
  const ol = await Club.create({ clubId: "1041", name: "Olympique Lyonnais", country: "France" });
  const monaco = await Club.create({ clubId: "162", name: "AS Monaco", country: "Monaco" });
  const arsenal = await Club.create({ clubId: "11", name: "Arsenal FC", country: "England", isExternal: true });
  await ClubSeason.create([
    { club: ol._id, season: fr2024._id },
    { club: monaco._id, season: fr2024._id },
    { club: arsenal._id, season: gb2024._id },
  ]);
});

describe("selector lists (MongoDB)", () => {
  it("lists the synced clubs by name", async () => {
    const clubs = await listClubs();
    expect(clubs.map((c) => c.name)).toEqual(["AS Monaco", "Olympique Lyonnais"]);
  });

  it("lists the clubs of a league's latest season", async () => {
    const clubs = await listClubs({ league: "GB1" });
    expect(clubs.map((c) => c.name)).toEqual(["Arsenal FC"]);
    expect(clubs[0].logoUrl).toContain("11");
  });

  it("leaves out clubs that only played an earlier season", async () => {
    const fr1 = await League.findOne({ competitionId: "FR1" });
    const older = await Season.findOne({ league: fr1._id, period: "2023/2024" });
    const relegated = await Club.create({ clubId: "1", name: "Club Relégué", country: "France" });
    await ClubSeason.create({ club: relegated._id, season: older._id });

    const clubs = await listClubs({ league: "FR1" });

    expect(clubs.map((c) => c.name)).toEqual(["AS Monaco", "Olympique Lyonnais"]);
  });

  it("lists a league's seasons newest first", async () => {
    const seasons = await listSeasons({ league: "FR1" });
    expect(seasons.map((s) => s.period)).toEqual(["2024/2025", "2023/2024"]);
    expect(seasons[0].league).toBe("FR1");
  });

  it("lists every season without a filter", async () => {
    expect(await listSeasons()).toHaveLength(3);
  });
});
