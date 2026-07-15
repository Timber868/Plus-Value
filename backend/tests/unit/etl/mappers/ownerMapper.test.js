/**
 * @file Unit tests for the pure transformations that shape an owners seed
 * entry into the Person + Owner fields the service persists. Owners have no
 * DuckDB source: entries come from the curated backend/data/seeds/owners.json
 * file, so validation also guards the hand-maintained optional fields
 * (netWorth >= 0, financialSustainabilityScore 1-100).
 */

const {
  toOwnerDoc,
  isValidOwnerDoc,
} = require("../../../../src/etl/mappers/ownerMapper");

describe("toOwnerDoc", () => {
  const seedEntry = {
    name: "Nasser Al-Khelaïfi",
    birthDate: "1973-11-12",
    nationality: "Qatar",
    netWorth: 8000000000,
    financialSustainabilityScore: 90,
  };

  test("carries name, nationality and the optional fields through unchanged", () => {
    const doc = toOwnerDoc(seedEntry);
    expect(doc.name).toBe("Nasser Al-Khelaïfi");
    expect(doc.nationality).toBe("Qatar");
    expect(doc.netWorth).toBe(8000000000);
    expect(doc.financialSustainabilityScore).toBe(90);
  });

  test("converts the birthDate string to a UTC Date", () => {
    const doc = toOwnerDoc(seedEntry);
    expect(doc.birthDate).toEqual(new Date("1973-11-12T00:00:00.000Z"));
  });

  test("keeps birthDate null when the entry has none", () => {
    const doc = toOwnerDoc({ ...seedEntry, birthDate: undefined });
    expect(doc.birthDate).toBeNull();
  });

  test("leaves absent optional fields undefined", () => {
    const doc = toOwnerDoc({
      name: "Minimal Owner",
      birthDate: "1960-01-01",
      nationality: "France",
    });
    expect(doc.netWorth).toBeUndefined();
    expect(doc.financialSustainabilityScore).toBeUndefined();
  });
});

describe("isValidOwnerDoc", () => {
  const validDoc = {
    name: "Nasser Al-Khelaïfi",
    birthDate: new Date("1973-11-12"),
    nationality: "Qatar",
    netWorth: 8000000000,
    financialSustainabilityScore: 90,
  };

  test("accepts a doc with every field", () => {
    expect(isValidOwnerDoc(validDoc)).toBe(true);
  });

  test("accepts a doc without the optional fields", () => {
    const minimal = {
      name: validDoc.name,
      birthDate: validDoc.birthDate,
      nationality: validDoc.nationality,
    };
    expect(isValidOwnerDoc(minimal)).toBe(true);
  });

  test("rejects a missing or empty name", () => {
    expect(isValidOwnerDoc({ ...validDoc, name: "" })).toBe(false);
    expect(isValidOwnerDoc({ ...validDoc, name: undefined })).toBe(false);
  });

  test("rejects a null birthDate", () => {
    expect(isValidOwnerDoc({ ...validDoc, birthDate: null })).toBe(false);
  });

  test("rejects a missing or empty nationality", () => {
    expect(isValidOwnerDoc({ ...validDoc, nationality: "" })).toBe(false);
    expect(isValidOwnerDoc({ ...validDoc, nationality: null })).toBe(false);
  });

  test("rejects a negative or non-numeric netWorth", () => {
    expect(isValidOwnerDoc({ ...validDoc, netWorth: -1 })).toBe(false);
    expect(isValidOwnerDoc({ ...validDoc, netWorth: "a lot" })).toBe(false);
  });

  test("accepts a zero netWorth", () => {
    expect(isValidOwnerDoc({ ...validDoc, netWorth: 0 })).toBe(true);
  });

  test("rejects a financialSustainabilityScore outside 1-100", () => {
    expect(
      isValidOwnerDoc({ ...validDoc, financialSustainabilityScore: 0 }),
    ).toBe(false);
    expect(
      isValidOwnerDoc({ ...validDoc, financialSustainabilityScore: 101 }),
    ).toBe(false);
    expect(
      isValidOwnerDoc({ ...validDoc, financialSustainabilityScore: "high" }),
    ).toBe(false);
  });

  test("accepts the score boundaries 1 and 100", () => {
    expect(
      isValidOwnerDoc({ ...validDoc, financialSustainabilityScore: 1 }),
    ).toBe(true);
    expect(
      isValidOwnerDoc({ ...validDoc, financialSustainabilityScore: 100 }),
    ).toBe(true);
  });
});
