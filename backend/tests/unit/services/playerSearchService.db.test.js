/**
 * @file Runs the player search aggregation against an in-memory MongoDB, so
 * the joins (Person, Player, Transfer, Club, MarketValue) are real. Like
 * Club.test.js, this needs the MongoDB binary and is verified in CI.
 */

const mongoose = require("mongoose");
const mongo = require("../../helpers/mongoMemory");
const Person = require("../../../src/models/Person");
const Player = require("../../../src/models/Player");
const Club = require("../../../src/models/Club");
const Transfer = require("../../../src/models/Transfer");
const MarketValue = require("../../../src/models/MarketValue");
const { searchPlayers } = require("../../../src/services/playerSearchService");

let lyon;
let arsenal;

async function addPlayer(playerId, name, transfers = [], values = []) {
  const person = await Person.create({ name, birthDate: new Date("1995-01-01"), nationality: "France" });
  const player = await Player.create({ playerId, person: person._id });
  for (const t of transfers) {
    await Transfer.create({ player: player._id, buyer: t.buyer._id, season: t.season, date: t.date });
  }
  for (const v of values) {
    await MarketValue.create({ player: player._id, date: v.date, value: v.value });
  }
  return player;
}

beforeAll(async () => {
  await mongo.start();
});

afterAll(async () => {
  await mongo.stop();
});

beforeEach(async () => {
  await mongo.clearAll();
  lyon = await Club.create({ clubId: "1041", name: "Olympique Lyonnais", country: "France" });
  arsenal = await Club.create({ clubId: "11", name: "Arsenal FC", country: "England" });
});

describe("searchPlayers (MongoDB)", () => {
  async function seed() {
    // Transfers only need a season reference here, not a Season document
    const seasonId = new mongoose.Types.ObjectId();
    const lacazette = await addPlayer(
      "1",
      "Alexandre Lacazette",
      [
        { buyer: lyon, season: seasonId, date: new Date("2010-07-01") },
        { buyer: arsenal, season: seasonId, date: new Date("2017-07-05") },
        { buyer: lyon, season: seasonId, date: new Date("2022-07-01") },
      ],
      [
        { date: new Date("2023-01-01"), value: 8000000 },
        { date: new Date("2024-06-01"), value: 5000000 },
      ],
    );
    await addPlayer("2", "Rayan Chérki", [{ buyer: lyon, season: seasonId, date: new Date("2019-07-01") }]);
    await addPlayer("3", "Lacazette Junior", [{ buyer: arsenal, season: seasonId, date: new Date("2020-07-01") }]);
    // Retired: last valued long before the newest valuation in the data
    await addPlayer("4", "Didier Drogba", [], [{ date: new Date("2018-06-01"), value: 500000 }]);
    // An owner is a Person without a Player and must not appear
    await Person.create({ name: "Lacazette Owner", birthDate: new Date("1960-01-01"), nationality: "France" });
    return { lacazette };
  }

  it("finds players by name with their current club and latest market value", async () => {
    const { lacazette } = await seed();

    const results = await searchPlayers({ query: "lacazette", clubId: null, limit: 20 });

    expect(results.map((r) => r.name)).toEqual(["Alexandre Lacazette", "Lacazette Junior"]);
    expect(results[0]).toEqual({
      id: String(lacazette._id),
      name: "Alexandre Lacazette",
      nationality: "France",
      position: null,
      subPosition: null,
      currentClub: { id: String(lyon._id), name: "Olympique Lyonnais" },
      latestMarketValue: { value: 5000000, date: new Date("2024-06-01") },
    });
    expect(results[1].latestMarketValue).toBeNull();
  });

  it("returns no market value for a player not revalued in the last market window", async () => {
    await seed();

    const [drogba] = await searchPlayers({ query: "drogba", clubId: null, limit: 20 });

    expect(drogba.latestMarketValue).toBeNull();
  });

  it("matches names without accents", async () => {
    await seed();

    const results = await searchPlayers({ query: "cherki", clubId: null, limit: 20 });

    expect(results.map((r) => r.name)).toEqual(["Rayan Chérki"]);
  });

  it("filters on the current club", async () => {
    await seed();

    const results = await searchPlayers({ query: "lacazette", clubId: String(arsenal._id), limit: 20 });

    expect(results.map((r) => r.name)).toEqual(["Lacazette Junior"]);
  });

  it("applies the limit", async () => {
    await seed();

    const results = await searchPlayers({ query: "a", clubId: null, limit: 1 });

    expect(results).toHaveLength(1);
  });
});
