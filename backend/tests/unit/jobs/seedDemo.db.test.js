/**
 * @file Loads the demo data into an in-memory MongoDB.
 * Like Club.test.js, this needs the MongoDB binary and is verified in CI.
 */

const mongo = require("../../helpers/mongoMemory");
const Club = require("../../../src/models/Club");
const ClubSeason = require("../../../src/models/ClubSeason");
const Player = require("../../../src/models/Player");
const Season = require("../../../src/models/Season");
const Transfer = require("../../../src/models/Transfer");
const MarketValue = require("../../../src/models/MarketValue");
const demo = require("../../../src/jobs/demo/demoData");
const { seed } = require("../../../src/jobs/seedDemo");
const { getSquadValue } = require("../../../src/services/squadValueService");

beforeAll(async () => {
  await mongo.start();
});

afterAll(async () => {
  await mongo.stop();
});

beforeEach(async () => {
  await mongo.clearAll();
});

describe("seed (MongoDB)", () => {
  it("loads the demo data and a second run does not duplicate it", async () => {
    await seed();
    const stats = await seed();

    expect(stats).toEqual({
      clubs: demo.CLUBS.length,
      seasons: demo.SEASONS.length,
      players: demo.PLAYERS.length,
      transfers: demo.TRANSFERS.length,
      valuations: demo.VALUATIONS.length,
    });
    expect(await Club.countDocuments()).toBe(demo.CLUBS.length);
    expect(await Season.countDocuments()).toBe(demo.SEASONS.length);
    expect(await Player.countDocuments()).toBe(demo.PLAYERS.length);
    expect(await Transfer.countDocuments()).toBe(demo.TRANSFERS.length);
    expect(await MarketValue.countDocuments()).toBe(demo.VALUATIONS.length);
    expect(await ClubSeason.countDocuments()).toBe(demo.CLUBS.filter((c) => c.inLeague).length * demo.SEASONS.length);
  });

  it("gives Lyon a squad the dashboard can show", async () => {
    await seed();
    const ol = await Club.findOne({ clubId: "1041" });
    const season = await Season.findOne({ period: "2025/2026" });

    const squad = await getSquadValue(String(ol._id), String(season._id));

    expect(squad.totals.playerCount).toBeGreaterThan(0);
    expect(squad.totals.totalValue).toBeGreaterThan(0);
  });
});
