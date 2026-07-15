/**
 * @file End-to-end test for the syncOwners job. Boots an in-memory MongoDB
 * (no Docker required) and a temp owners.json seed file so the full
 * seed → mapper → service → Mongo pipeline runs against real I/O.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const mongo = require("../helpers/mongoMemory");

const Person = require("../../src/models/Person");
const Owner = require("../../src/models/Owner");
const { run } = require("../../src/jobs/syncOwners");

const SEED = [
  {
    name: "Nasser Al-Khelaïfi",
    birthDate: "1973-11-12",
    nationality: "Qatar",
    netWorth: 8000000000,
    financialSustainabilityScore: 90,
  },
  {
    // No optional fields: still a valid owner.
    name: "John Textor",
    birthDate: "1965-09-30",
    nationality: "United States",
  },
  {
    // Missing nationality: must be skipped.
    name: "Invalid Owner",
    birthDate: "1970-01-01",
  },
];

let seedPath;

beforeAll(async () => {
  await mongo.start();
  await Promise.all([Person.init(), Owner.init()]);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "plusvalue-owners-int-"));
  seedPath = path.join(dir, "owners.json");
  fs.writeFileSync(seedPath, JSON.stringify(SEED));
});

afterAll(async () => {
  await mongo.stop();
});

beforeEach(async () => {
  await mongo.clearAll();
});

describe("syncOwners job (integration)", () => {
  test("creates one Person and one linked Owner per valid seed entry", async () => {
    const stats = await run({ seedPath });

    expect(stats.ownersSynced).toBe(2);
    expect(await Person.countDocuments()).toBe(2);
    expect(await Owner.countDocuments()).toBe(2);

    const person = await Person.findOne({ name: "Nasser Al-Khelaïfi" });
    const owner = await Owner.findOne({ person: person._id });
    expect(person.nationality).toBe("Qatar");
    expect(person.birthDate).toEqual(new Date("1973-11-12T00:00:00.000Z"));
    expect(owner.netWorth).toBe(8000000000);
    expect(owner.financialSustainabilityScore).toBe(90);
  });

  test("an owner without optional fields loads without them", async () => {
    await run({ seedPath });

    const person = await Person.findOne({ name: "John Textor" });
    const owner = await Owner.findOne({ person: person._id });
    expect(owner).not.toBeNull();
    expect(owner.netWorth).toBeUndefined();
    expect(owner.financialSustainabilityScore).toBeUndefined();
  });

  test("skips invalid seed entries with a count", async () => {
    const stats = await run({ seedPath });

    expect(stats.inspected).toBe(3);
    expect(stats.skipped).toBe(1);
    expect(await Person.findOne({ name: "Invalid Owner" })).toBeNull();
  });

  test("a second identical run does not duplicate any documents", async () => {
    await run({ seedPath });
    await run({ seedPath });

    expect(await Person.countDocuments()).toBe(2);
    expect(await Owner.countDocuments()).toBe(2);
  });

  test("a re-run picks up edits to the seed file", async () => {
    await run({ seedPath });

    const edited = SEED.map((e) =>
      e.name === "Nasser Al-Khelaïfi"
        ? { ...e, financialSustainabilityScore: 75 }
        : e,
    );
    fs.writeFileSync(seedPath, JSON.stringify(edited));

    await run({ seedPath });

    const person = await Person.findOne({ name: "Nasser Al-Khelaïfi" });
    const owner = await Owner.findOne({ person: person._id });
    expect(owner.financialSustainabilityScore).toBe(75);

    // Restore the original seed for the other tests.
    fs.writeFileSync(seedPath, JSON.stringify(SEED));
  });
});
