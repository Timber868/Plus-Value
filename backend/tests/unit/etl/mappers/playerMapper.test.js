/**
 * @file Unit tests for the pure transformations that shape a players reader
 * row into the Person + Player fields the service persists. Covers the
 * birthDate string → Date conversion (with null pass-through) and the
 * validation gate that skips rows missing any required Person field.
 */

const {
  toPlayerDoc,
  isValidPlayerDoc,
} = require("../../../../src/etl/mappers/playerMapper");

describe("toPlayerDoc", () => {
  const readerRow = {
    playerId: "1",
    name: "Kylian Mbappé",
    birthDate: "1998-12-20",
    nationality: "France",
  };

  test("carries playerId, name and nationality through unchanged", () => {
    const doc = toPlayerDoc(readerRow);
    expect(doc.playerId).toBe("1");
    expect(doc.name).toBe("Kylian Mbappé");
    expect(doc.nationality).toBe("France");
  });

  test("converts the birthDate string to a UTC Date", () => {
    const doc = toPlayerDoc(readerRow);
    expect(doc.birthDate).toEqual(new Date("1998-12-20T00:00:00.000Z"));
  });

  test("keeps birthDate null when the source has no date of birth", () => {
    const doc = toPlayerDoc({ ...readerRow, birthDate: null });
    expect(doc.birthDate).toBeNull();
  });

  test("produces exactly the six persisted fields", () => {
    expect(Object.keys(toPlayerDoc(readerRow)).sort()).toEqual([
      "birthDate",
      "name",
      "nationality",
      "playerId",
      "position",
      "subPosition",
    ]);
  });

  test("carries the position and sub-position, and turns Missing or empty into null", () => {
    expect(toPlayerDoc({ ...readerRow, position: "Attack", subPosition: "Centre-Forward" })).toMatchObject({
      position: "Attack",
      subPosition: "Centre-Forward",
    });
    expect(toPlayerDoc({ ...readerRow, position: "Missing", subPosition: "" })).toMatchObject({
      position: null,
      subPosition: null,
    });
    expect(toPlayerDoc(readerRow)).toMatchObject({ position: null, subPosition: null });
  });
});

describe("isValidPlayerDoc", () => {
  const validDoc = {
    playerId: "1",
    name: "Kylian Mbappé",
    birthDate: new Date("1998-12-20"),
    nationality: "France",
  };

  test("accepts a doc with every required field", () => {
    expect(isValidPlayerDoc(validDoc)).toBe(true);
  });

  test("rejects a missing or empty playerId", () => {
    expect(isValidPlayerDoc({ ...validDoc, playerId: "" })).toBe(false);
    expect(isValidPlayerDoc({ ...validDoc, playerId: undefined })).toBe(false);
  });

  test("rejects a missing or empty name", () => {
    expect(isValidPlayerDoc({ ...validDoc, name: "" })).toBe(false);
    expect(isValidPlayerDoc({ ...validDoc, name: null })).toBe(false);
  });

  test("rejects a null birthDate", () => {
    expect(isValidPlayerDoc({ ...validDoc, birthDate: null })).toBe(false);
  });

  test("rejects a missing or empty nationality", () => {
    expect(isValidPlayerDoc({ ...validDoc, nationality: "" })).toBe(false);
    expect(isValidPlayerDoc({ ...validDoc, nationality: null })).toBe(false);
  });
});
