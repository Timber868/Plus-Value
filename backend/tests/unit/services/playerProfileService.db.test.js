/**
 * @file Runs the player profile queries against an in-memory MongoDB. Like
 * Club.test.js, this needs the MongoDB binary and is verified in CI.
 */

const mongoose = require("mongoose");
const mongo = require("../../helpers/mongoMemory");
const Person = require("../../../src/models/Person");
const Player = require("../../../src/models/Player");
const Club = require("../../../src/models/Club");
const Transfer = require("../../../src/models/Transfer");
const MarketValue = require("../../../src/models/MarketValue");
const { getPlayerProfile } = require("../../../src/services/playerProfileService");

beforeAll(async () => {
  await mongo.start();
});

afterAll(async () => {
  await mongo.stop();
});

beforeEach(async () => {
  await mongo.clearAll();
});

describe("getPlayerProfile (MongoDB)", () => {
  it("builds the profile from the person, latest transfer and market values", async () => {
    const lyon = await Club.create({ clubId: "1041", name: "Olympique Lyonnais", country: "France" });
    const arsenal = await Club.create({ clubId: "11", name: "Arsenal FC", country: "England" });
    const person = await Person.create({
      name: "Alexandre Lacazette",
      birthDate: new Date("1991-05-28"),
      nationality: "France",
    });
    const player = await Player.create({ playerId: "1", person: person._id, position: "Attack", subPosition: "Centre-Forward" });
    // Transfers only need a season reference here, not a Season document
    const season = new mongoose.Types.ObjectId();
    await Transfer.create({ player: player._id, buyer: arsenal._id, season, date: new Date("2017-07-05") });
    await Transfer.create({ player: player._id, buyer: lyon._id, season, date: new Date("2022-07-01") });
    await MarketValue.create({ player: player._id, date: new Date("2018-01-01"), value: 60000000 });
    await MarketValue.create({ player: player._id, date: new Date("2024-06-01"), value: 5000000 });

    const profile = await getPlayerProfile(String(player._id));

    expect(profile).toEqual({
      id: String(player._id),
      name: "Alexandre Lacazette",
      birthDate: new Date("1991-05-28"),
      nationality: "France",
      position: "Attack",
      subPosition: "Centre-Forward",
      currentClub: { id: String(lyon._id), name: "Olympique Lyonnais" },
      latestMarketValue: { value: 5000000, date: new Date("2024-06-01") },
      peakMarketValue: { value: 60000000, date: new Date("2018-01-01") },
    });
  });

  it("returns no latest value for a player not revalued in the last market window", async () => {
    const recent = await Player.create({
      playerId: "2",
      person: (await Person.create({ name: "Recent", birthDate: new Date("2000-01-01"), nationality: "France" }))._id,
    });
    await MarketValue.create({ player: recent._id, date: new Date("2025-12-18"), value: 5000000 });
    const person = await Person.create({ name: "Didier Drogba", birthDate: new Date("1978-03-11"), nationality: "Cote d'Ivoire" });
    const drogba = await Player.create({ playerId: "3", person: person._id });
    await MarketValue.create({ player: drogba._id, date: new Date("2007-04-25"), value: 38500000 });
    await MarketValue.create({ player: drogba._id, date: new Date("2018-06-01"), value: 500000 });

    const profile = await getPlayerProfile(String(drogba._id));

    expect(profile.latestMarketValue).toBeNull();
    expect(profile.peakMarketValue).toEqual({ value: 38500000, date: new Date("2007-04-25") });
  });

  it("returns null for an unknown player", async () => {
    expect(await getPlayerProfile(String(new mongoose.Types.ObjectId()))).toBeNull();
  });
});
