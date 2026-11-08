/**
 * @file Runs the squad value queries against an in-memory MongoDB.
 * Like Club.test.js, this needs the MongoDB binary and is verified in CI.
 */

const mongoose = require("mongoose");
const mongo = require("../../helpers/mongoMemory");
const Person = require("../../../src/models/Person");
const Player = require("../../../src/models/Player");
const Club = require("../../../src/models/Club");
const Season = require("../../../src/models/Season");
const ClubSeason = require("../../../src/models/ClubSeason");
const Transfer = require("../../../src/models/Transfer");
const MarketValue = require("../../../src/models/MarketValue");
const { getSquadValue, getSquadValueHistory } = require("../../../src/services/squadValueService");

beforeAll(async () => {
  await mongo.start();
});

afterAll(async () => {
  await mongo.stop();
});

beforeEach(async () => {
  await mongo.clearAll();
});

describe("getSquadValue (MongoDB)", () => {
  it("sums the values of the players at the club at the season's end", async () => {
    const ol = await Club.create({ clubId: "1041", name: "Olympique Lyonnais", country: "France" });
    const mci = await Club.create({ clubId: "281", name: "Manchester City", country: "England" });
    const season = await Season.create({ league: new mongoose.Types.ObjectId(), startDate: new Date("2024-08-16"), endDate: new Date("2025-05-17") });
    const transferSeason = new mongoose.Types.ObjectId();
    const addPlayer = async (playerId, name, position) => {
      const person = await Person.create({ name, birthDate: new Date("2000-01-01"), nationality: "France" });
      return Player.create({ playerId, person: person._id, position });
    };
    const lacazette = await addPlayer("1", "Alexandre Lacazette", "Attack");
    const cherki = await addPlayer("2", "Rayan Cherki", "Attack");
    await Transfer.create([
      { player: lacazette._id, buyer: ol._id, season: transferSeason, date: new Date("2022-07-01") },
      { player: cherki._id, buyer: ol._id, season: transferSeason, date: new Date("2019-07-01") },
      { player: cherki._id, buyer: mci._id, seller: ol._id, season: transferSeason, date: new Date("2025-07-01"), price: 36500000 },
    ]);
    await MarketValue.create([
      { player: lacazette._id, date: new Date("2025-03-01"), value: 4000000 },
      { player: cherki._id, date: new Date("2025-03-01"), value: 30000000 },
    ]);

    const result = await getSquadValue(String(ol._id), String(season._id));

    expect(result.players.map((p) => p.name)).toEqual(["Rayan Cherki", "Alexandre Lacazette"]);
    expect(result.totals).toMatchObject({ totalValue: 34000000, playerCount: 2, valuedPlayerCount: 2 });
    expect(result.totals.byPosition).toEqual([{ position: "Attack", playerCount: 2, totalValue: 34000000 }]);

    await ClubSeason.create({ club: ol._id, season: season._id });
    const history = await getSquadValueHistory(String(ol._id));
    expect(history.seasons).toEqual([
      expect.objectContaining({ season: { id: String(season._id), period: "2024/2025" }, totalValue: 34000000, playerCount: 2 }),
    ]);
  });

  it("returns null for an unknown season", async () => {
    const ol = await Club.create({ clubId: "1041", name: "Olympique Lyonnais", country: "France" });

    expect(await getSquadValue(String(ol._id), String(new mongoose.Types.ObjectId()))).toBeNull();
  });
});
