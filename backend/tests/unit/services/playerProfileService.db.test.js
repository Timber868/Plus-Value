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
    const player = await Player.create({ playerId: "1", person: person._id });
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
      currentClub: { id: String(lyon._id), name: "Olympique Lyonnais" },
      latestMarketValue: { value: 5000000, date: new Date("2024-06-01") },
      peakMarketValue: { value: 60000000, date: new Date("2018-01-01") },
    });
  });

  it("returns null for an unknown player", async () => {
    expect(await getPlayerProfile(String(new mongoose.Types.ObjectId()))).toBeNull();
  });
});
