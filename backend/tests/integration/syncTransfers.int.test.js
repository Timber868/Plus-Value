/**
 * @file End-to-end test for the syncTransfers job. Boots an in-memory MongoDB
 * (no Docker required) and fixture DuckDB files so the full
 * reader → mapper → service → Mongo pipeline runs against real I/O.
 *
 * Prerequisites are seeded per test: the FR1 league, the 2024/2025 season,
 * the Ligue 1 club "10", and the players from the players fixture. The
 * transfers fixture then exercises incoming/outgoing transfers, a free
 * transfer, an unsynced season, and an unknown player.
 */

const mongo = require("../helpers/mongoMemory");
const playersFixture = require("../fixtures/buildPlayersFixture");
const {
  LOADABLE_COUNT,
  buildFixture,
  freshFixturePath,
} = require("../fixtures/buildTransfersFixture");

const League = require("../../src/models/League");
const Club = require("../../src/models/Club");
const Player = require("../../src/models/Player");
const Transfer = require("../../src/models/Transfer");
const syncSeasons = require("../../src/jobs/syncSeasons");
const syncPlayers = require("../../src/jobs/syncPlayers");
const { run } = require("../../src/jobs/syncTransfers");

let playersPath;
let transfersPath;

beforeAll(async () => {
  await mongo.start();
  await Promise.all([Club.init(), Player.init(), Transfer.init()]);
  playersPath = playersFixture.freshFixturePath("syncTransfers");
  await playersFixture.buildFixture(playersPath);
  transfersPath = freshFixturePath("syncTransfers");
  await buildFixture(transfersPath);
});

afterAll(async () => {
  await mongo.stop();
});

beforeEach(async () => {
  await mongo.clearAll();
  await League.create({
    competitionId: "FR1",
    name: "Ligue 1",
    country: "France",
    confederation: "UEFA",
    competitionFormat: "league",
  });
  await syncSeasons.run({ season: "2024", competitionId: "FR1" });
  await Club.create({ clubId: "10", name: "Paris SG", country: "France" });
  await syncPlayers.run({ dbPath: playersPath });
});

describe("syncTransfers job (integration)", () => {
  test("throws when the league has not been synced yet", async () => {
    await League.deleteMany({});
    await expect(run({ dbPath: transfersPath })).rejects.toThrow(
      /league not found/i,
    );
  });

  test("loads every resolvable transfer with linked player, clubs and season", async () => {
    const stats = await run({ dbPath: transfersPath });

    expect(stats.transfersSynced).toBe(LOADABLE_COUNT);
    expect(await Transfer.countDocuments()).toBe(LOADABLE_COUNT);

    const player = await Player.findOne({ playerId: "1" });
    const incoming = await Transfer.findOne({ player: player._id })
      .populate("buyer")
      .populate("seller");
    expect(incoming.buyer.clubId).toBe("10");
    expect(incoming.seller.clubId).toBe("99");
    expect(incoming.price).toBe(180000000);
    expect(incoming.window).toBe("summer");
  });

  test("creates foreign transfer partners as external clubs, once", async () => {
    await run({ dbPath: transfersPath });

    const chelsea = await Club.findOne({ clubId: "88" });
    const real = await Club.findOne({ clubId: "99" });
    expect(chelsea.isExternal).toBe(true);
    expect(chelsea.name).toBe("Chelsea");
    expect(chelsea.country).toBe("Unknown");
    expect(real.isExternal).toBe(true);

    // The pre-seeded Ligue 1 club must not have been flagged external.
    const psg = await Club.findOne({ clubId: "10" });
    expect(psg.isExternal).toBe(false);
    expect(psg.country).toBe("France");
  });

  test("a free transfer loads without a price", async () => {
    await run({ dbPath: transfersPath });

    const player = await Player.findOne({ playerId: "2" });
    const free = await Transfer.findOne({
      player: player._id,
      date: new Date("2024-07-01T00:00:00.000Z"),
    });
    expect(free).not.toBeNull();
    expect(free.price).toBeUndefined();
  });

  test("skips unsynced seasons and unknown players, with counts", async () => {
    const stats = await run({ dbPath: transfersPath });

    expect(stats.inspected).toBe(5);
    expect(stats.skippedUnresolvedSeason).toBe(1);
    expect(stats.skippedUnresolvedPlayer).toBe(1);
  });

  test("a second identical run does not duplicate any documents", async () => {
    const first = await run({ dbPath: transfersPath });
    const second = await run({ dbPath: transfersPath });

    expect(second.transfersUpserted).toBe(0);
    expect(second.externalClubsUpserted).toBe(0);
    expect(await Transfer.countDocuments()).toBe(first.transfersSynced);
  });
});
