/**
 * @file Runs the market value time series query against an in-memory MongoDB.
 * Like Club.test.js, this needs the MongoDB binary and is verified in CI.
 */

const mongoose = require("mongoose");
const mongo = require("../../helpers/mongoMemory");
const Person = require("../../../src/models/Person");
const Player = require("../../../src/models/Player");
const MarketValue = require("../../../src/models/MarketValue");
const { getMarketValueSeries } = require("../../../src/services/playerMarketValueService");

let player;

beforeAll(async () => {
  await mongo.start();
});

afterAll(async () => {
  await mongo.stop();
});

beforeEach(async () => {
  await mongo.clearAll();
  const person = await Person.create({ name: "Rayan Cherki", birthDate: new Date("2003-08-17"), nationality: "France" });
  player = await Player.create({ playerId: "1", person: person._id });
  const other = await Player.create({
    playerId: "2",
    person: (await Person.create({ name: "Other", birthDate: new Date("2000-01-01"), nationality: "France" }))._id,
  });
  // Inserted out of order on purpose
  await MarketValue.create([
    { player: player._id, date: new Date("2023-06-01"), value: 25000000 },
    { player: player._id, date: new Date("2021-06-01"), value: 10000000 },
    { player: player._id, date: new Date("2024-12-01"), value: 30000000 },
    { player: other._id, date: new Date("2022-06-01"), value: 1000000 },
  ]);
});

describe("getMarketValueSeries (MongoDB)", () => {
  it("returns the player's values oldest first as { date, value }", async () => {
    const series = await getMarketValueSeries(String(player._id), { from: null, to: null });

    expect(series).toEqual([
      { date: new Date("2021-06-01"), value: 10000000 },
      { date: new Date("2023-06-01"), value: 25000000 },
      { date: new Date("2024-12-01"), value: 30000000 },
    ]);
  });

  it("keeps only values within the inclusive range", async () => {
    const series = await getMarketValueSeries(String(player._id), {
      from: new Date("2023-06-01"),
      to: new Date("2024-01-01"),
    });

    expect(series).toEqual([{ date: new Date("2023-06-01"), value: 25000000 }]);
  });

  it("returns an empty list for a player without values", async () => {
    await MarketValue.deleteMany({ player: player._id });

    expect(await getMarketValueSeries(String(player._id), { from: null, to: null })).toEqual([]);
  });

  it("returns null for an unknown player", async () => {
    expect(await getMarketValueSeries(String(new mongoose.Types.ObjectId()), { from: null, to: null })).toBeNull();
  });
});
