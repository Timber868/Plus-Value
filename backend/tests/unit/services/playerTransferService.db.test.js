/**
 * @file Runs a player's transfer list query against an in-memory MongoDB.
 * Like Club.test.js, this needs the MongoDB binary and is verified in CI.
 */

const mongoose = require("mongoose");
const mongo = require("../../helpers/mongoMemory");
const Person = require("../../../src/models/Person");
const Player = require("../../../src/models/Player");
const Club = require("../../../src/models/Club");
const Transfer = require("../../../src/models/Transfer");
const { getPlayerTransfers } = require("../../../src/services/playerTransferService");

let player;
let ol;
let arsenal;

beforeAll(async () => {
  await mongo.start();
});

afterAll(async () => {
  await mongo.stop();
});

beforeEach(async () => {
  await mongo.clearAll();
  const person = await Person.create({ name: "Alexandre Lacazette", birthDate: new Date("1991-05-28"), nationality: "France" });
  player = await Player.create({ playerId: "1", person: person._id });
  const other = await Player.create({
    playerId: "2",
    person: (await Person.create({ name: "Other", birthDate: new Date("2000-01-01"), nationality: "France" }))._id,
  });
  ol = await Club.create({ clubId: "1041", name: "Olympique Lyonnais", country: "France" });
  arsenal = await Club.create({ clubId: "11", name: "Arsenal FC", country: "England" });
  const season = new mongoose.Types.ObjectId();
  // Inserted out of order on purpose
  await Transfer.create([
    { player: player._id, buyer: ol._id, seller: arsenal._id, season, date: new Date("2022-07-01"), price: 0 },
    { player: player._id, buyer: arsenal._id, seller: ol._id, season, date: new Date("2017-07-05"), price: 53000000 },
    { player: other._id, buyer: ol._id, season, date: new Date("2019-07-01") },
  ]);
});

describe("getPlayerTransfers (MongoDB)", () => {
  it("returns the player's transfers oldest first with club names", async () => {
    const transfers = await getPlayerTransfers(String(player._id));

    expect(transfers).toEqual([
      {
        date: new Date("2017-07-05"),
        fromClub: { id: String(ol._id), name: "Olympique Lyonnais" },
        toClub: { id: String(arsenal._id), name: "Arsenal FC" },
        fee: 53000000,
      },
      {
        date: new Date("2022-07-01"),
        fromClub: { id: String(arsenal._id), name: "Arsenal FC" },
        toClub: { id: String(ol._id), name: "Olympique Lyonnais" },
        fee: 0,
      },
    ]);
  });

  it("returns null for an unknown player", async () => {
    expect(await getPlayerTransfers(String(new mongoose.Types.ObjectId()))).toBeNull();
  });
});
