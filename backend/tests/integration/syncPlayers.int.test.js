/**
 * @file End-to-end test for the syncPlayers job. Boots an in-memory MongoDB
 * (no Docker required) and a fixture DuckDB file so the full
 * reader → mapper → service → Mongo pipeline runs against real I/O. The
 * fixture contains two fully-valid players plus three rows each missing one
 * required Person field, which the job must skip.
 */

const mongo = require("../helpers/mongoMemory");
const {
  VALID_COUNT,
  buildFixture,
  freshFixturePath,
} = require("../fixtures/buildPlayersFixture");

const Person = require("../../src/models/Person");
const Player = require("../../src/models/Player");
const { run } = require("../../src/jobs/syncPlayers");

let fixturePath;

beforeAll(async () => {
  await mongo.start();
  await Promise.all([Person.init(), Player.init()]);
  fixturePath = freshFixturePath("syncPlayers");
  await buildFixture(fixturePath);
});

afterAll(async () => {
  await mongo.stop();
});

beforeEach(async () => {
  await mongo.clearAll();
});

describe("syncPlayers job (integration)", () => {
  test("creates one Person and one linked Player per valid source row", async () => {
    const stats = await run({ dbPath: fixturePath });

    expect(stats.playersSynced).toBe(VALID_COUNT);
    expect(await Person.countDocuments()).toBe(VALID_COUNT);
    expect(await Player.countDocuments()).toBe(VALID_COUNT);

    const player = await Player.findOne({ playerId: "1" }).populate("person");
    expect(player).not.toBeNull();
    expect(player.person.name).toBe("Kylian Mbappé");
    expect(player.person.nationality).toBe("France");
    expect(player.person.birthDate).toEqual(
      new Date("1998-12-20T00:00:00.000Z"),
    );
  });

  test("skips source rows missing a required Person field", async () => {
    const stats = await run({ dbPath: fixturePath });

    expect(stats.inspected).toBe(5);
    expect(stats.skipped).toBe(3);
    expect(await Player.findOne({ playerId: "3" })).toBeNull();
    expect(await Player.findOne({ playerId: "4" })).toBeNull();
  });

  test("a second identical run does not duplicate any documents", async () => {
    const first = await run({ dbPath: fixturePath });
    const second = await run({ dbPath: fixturePath });

    expect(second.playersUpserted).toBe(0);
    expect(await Person.countDocuments()).toBe(first.playersSynced);
    expect(await Player.countDocuments()).toBe(first.playersSynced);
  });

  // Person fields are sourced from DuckDB, so a re-sync must restore them if
  // they drift (unlike manually-curated Club fields, which syncs preserve).
  test("a re-run refreshes Person fields back to the source values", async () => {
    await run({ dbPath: fixturePath });
    const player = await Player.findOne({ playerId: "1" });
    await Person.updateOne(
      { _id: player.person },
      { $set: { name: "Wrong Name" } },
    );

    const stats = await run({ dbPath: fixturePath });

    expect(stats.personsModified).toBeGreaterThanOrEqual(1);
    const person = await Person.findById(player.person);
    expect(person.name).toBe("Kylian Mbappé");
  });
});
