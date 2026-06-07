/**
 * @file Focused model tests for the Club schema changes that the season
 * updater depends on: a required + unique `clubId` natural key, and a
 * `creationDate` that is now optional (the DuckDB clubs table has no founding
 * date). Uses an in-memory MongoDB so index/validation behaviour is real.
 */

const mongoose = require("mongoose");
const mongo = require("../../tests/helpers/mongoMemory");
const Club = require("./Club");

beforeAll(async () => {
  await mongo.start();
  // Index enforcement (unique clubId) only kicks in once indexes are built.
  await Club.init();
});

afterAll(async () => {
  await mongo.stop();
});

beforeEach(async () => {
  await mongo.clearAll();
});

describe("Club model", () => {
  test("saves without a creationDate (now optional)", async () => {
    const club = await Club.create({
      clubId: "10004",
      name: "Paris Football Club",
      country: "France",
    });
    expect(club.creationDate).toBeUndefined();
  });

  test("requires clubId", async () => {
    await expect(
      Club.create({ name: "No Id FC", country: "France" }),
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });

  test("requires name", async () => {
    await expect(
      Club.create({ clubId: "10005", country: "France" }),
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });

  test("rejects a duplicate clubId (unique index)", async () => {
    await Club.create({ clubId: "10004", name: "Paris FC", country: "France" });
    await expect(
      Club.create({ clubId: "10004", name: "Other FC", country: "France" }),
    ).rejects.toThrow(/duplicate key/i);
  });

  test("trims clubId whitespace", async () => {
    const club = await Club.create({
      clubId: "  583  ",
      name: "Olympique de Marseille",
      country: "France",
    });
    expect(club.clubId).toBe("583");
  });
});
