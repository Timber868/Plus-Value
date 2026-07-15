/**
 * @file End-to-end test for the syncMarketValues job. Boots an in-memory
 * MongoDB (no Docker required) and fixture DuckDB files so the full
 * reader → mapper → service → Mongo pipeline runs against real I/O. Players
 * are synced first from the players fixture (ids "1" and "2"); the valuations
 * fixture then contains three loadable snapshots plus a negative-value row
 * and a row for an unknown player, both of which must be skipped.
 */

const mongo = require("../helpers/mongoMemory");
const playersFixture = require("../fixtures/buildPlayersFixture");
const {
  LOADABLE_COUNT,
  buildFixture,
  freshFixturePath,
} = require("../fixtures/buildValuationsFixture");

const Player = require("../../src/models/Player");
const MarketValue = require("../../src/models/MarketValue");
const syncPlayers = require("../../src/jobs/syncPlayers");
const { run } = require("../../src/jobs/syncMarketValues");

let playersPath;
let valuationsPath;

beforeAll(async () => {
  await mongo.start();
  await Promise.all([Player.init(), MarketValue.init()]);
  playersPath = playersFixture.freshFixturePath("syncMarketValues");
  await playersFixture.buildFixture(playersPath);
  valuationsPath = freshFixturePath("syncMarketValues");
  await buildFixture(valuationsPath);
});

afterAll(async () => {
  await mongo.stop();
});

beforeEach(async () => {
  await mongo.clearAll();
  await syncPlayers.run({ dbPath: playersPath });
});

describe("syncMarketValues job (integration)", () => {
  test("creates one MarketValue per loadable snapshot, linked to the player", async () => {
    const stats = await run({ dbPath: valuationsPath });

    expect(stats.marketValuesSynced).toBe(LOADABLE_COUNT);
    expect(await MarketValue.countDocuments()).toBe(LOADABLE_COUNT);

    const player = await Player.findOne({ playerId: "1" });
    const values = await MarketValue.find({ player: player._id }).sort({
      date: 1,
    });
    expect(values).toHaveLength(2);
    expect(values[0].value).toBe(150000000);
    expect(values[1].value).toBe(180000000);
  });

  test("skips the negative-value row and the unknown player's row", async () => {
    const stats = await run({ dbPath: valuationsPath });

    expect(stats.inspected).toBe(5);
    expect(stats.skippedInvalid).toBe(1);
    expect(stats.skippedUnresolvedPlayer).toBe(1);
  });

  test("a second identical run does not duplicate any documents", async () => {
    const first = await run({ dbPath: valuationsPath });
    const second = await run({ dbPath: valuationsPath });

    expect(second.marketValuesUpserted).toBe(0);
    expect(await MarketValue.countDocuments()).toBe(first.marketValuesSynced);
  });
});
