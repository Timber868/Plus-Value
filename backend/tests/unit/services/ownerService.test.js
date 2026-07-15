/**
 * @file Unit tests for the Owner service. The Person and Owner models are
 * mocked so these run without a Mongo instance; the full Mongo path is
 * exercised in tests/integration/syncOwners.int.test.js.
 *
 * The seed file is tiny (a curated list, not a dataset dump), so the service
 * upserts one owner at a time: Person keyed by name, then Owner keyed by the
 * person ref.
 */

jest.mock("../../../src/models/Person", () => ({
  findOneAndUpdate: jest.fn(),
}));
jest.mock("../../../src/models/Owner", () => ({
  findOneAndUpdate: jest.fn(),
}));

const Person = require("../../../src/models/Person");
const Owner = require("../../../src/models/Owner");
const { upsertOwner, upsertMany } = require("../../../src/services/ownerService");

function makeDoc(overrides = {}) {
  return {
    name: "Nasser Al-Khelaïfi",
    birthDate: new Date("1973-11-12"),
    nationality: "Qatar",
    netWorth: 8000000000,
    financialSustainabilityScore: 90,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  Person.findOneAndUpdate.mockResolvedValue({ _id: "person-oid" });
  Owner.findOneAndUpdate.mockResolvedValue({ _id: "owner-oid" });
});

describe("upsertOwner", () => {
  test("upserts the Person keyed by name with refreshed fields", async () => {
    const doc = makeDoc();
    await upsertOwner(doc);

    expect(Person.findOneAndUpdate).toHaveBeenCalledWith(
      { name: doc.name },
      { $set: { birthDate: doc.birthDate, nationality: doc.nationality } },
      { upsert: true, new: true },
    );
  });

  test("upserts the Owner keyed by the person ref with the optional fields", async () => {
    await upsertOwner(makeDoc());

    expect(Owner.findOneAndUpdate).toHaveBeenCalledWith(
      { person: "person-oid" },
      { $set: { netWorth: 8000000000, financialSustainabilityScore: 90 } },
      { upsert: true, new: true },
    );
  });

  test("omits absent optional fields from the Owner update", async () => {
    await upsertOwner(
      makeDoc({ netWorth: undefined, financialSustainabilityScore: undefined }),
    );

    expect(Owner.findOneAndUpdate).toHaveBeenCalledWith(
      { person: "person-oid" },
      {},
      { upsert: true, new: true },
    );
  });

  test("keeps a zero netWorth in the Owner update", async () => {
    await upsertOwner(makeDoc({ netWorth: 0 }));

    const update = Owner.findOneAndUpdate.mock.calls[0][1];
    expect(update.$set.netWorth).toBe(0);
  });
});

describe("upsertMany", () => {
  test("does nothing for an empty array", async () => {
    const stats = await upsertMany([]);
    expect(stats).toEqual({ synced: 0 });
    expect(Person.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("upserts each doc and counts them", async () => {
    const stats = await upsertMany([
      makeDoc(),
      makeDoc({ name: "Other Owner" }),
    ]);

    expect(stats).toEqual({ synced: 2 });
    expect(Person.findOneAndUpdate).toHaveBeenCalledTimes(2);
    expect(Owner.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  test("propagates errors from the underlying writes", async () => {
    Person.findOneAndUpdate.mockRejectedValueOnce(new Error("boom"));
    await expect(upsertMany([makeDoc()])).rejects.toThrow("boom");
  });
});
