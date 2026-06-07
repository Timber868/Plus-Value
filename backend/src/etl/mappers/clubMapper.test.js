/**
 * @file Unit tests for the pure club-shaping helpers. The DuckDB clubs table
 * has no country column (only domestic_competition_id), so country is injected
 * by the caller from the linked League. Manual fields (financialScore, etc.)
 * are never produced here.
 */

const { toClubDoc, isValidClubDoc } = require("./clubMapper");

/** Mirrors a row from the standings reader (already camelCased). */
const readerRow = {
  clubId: "10004",
  name: "Paris Football Club",
  points: 42,
  goalDiff: 5,
};

describe("toClubDoc", () => {
  test("keeps clubId and name and injects the provided country", () => {
    expect(toClubDoc(readerRow, "France")).toEqual({
      clubId: "10004",
      name: "Paris Football Club",
      country: "France",
    });
  });

  // Seasonal stats (points/goalDiff) belong on ClubSeason, not Club.
  test("does not leak seasonal stats into the club document", () => {
    const doc = toClubDoc(readerRow, "France");
    expect(doc).not.toHaveProperty("points");
    expect(doc).not.toHaveProperty("goalDiff");
  });

  test("forwards clubId exactly", () => {
    expect(toClubDoc({ ...readerRow, clubId: "583" }, "France").clubId).toBe(
      "583",
    );
  });
});

describe("isValidClubDoc", () => {
  const validDoc = { clubId: "10004", name: "Paris FC", country: "France" };

  test("returns true when clubId and name are present", () => {
    expect(isValidClubDoc(validDoc)).toBe(true);
  });

  test("returns false when clubId is missing", () => {
    expect(isValidClubDoc({ ...validDoc, clubId: undefined })).toBe(false);
  });

  // Empty strings pass Mongoose `required` but would collide on the unique
  // index, so treat them as invalid up front (same guard as leagues).
  test("returns false when clubId is an empty string", () => {
    expect(isValidClubDoc({ ...validDoc, clubId: "" })).toBe(false);
  });

  test("returns false when name is missing", () => {
    expect(isValidClubDoc({ ...validDoc, name: undefined })).toBe(false);
  });

  test("returns false when name is an empty string", () => {
    expect(isValidClubDoc({ ...validDoc, name: "" })).toBe(false);
  });

  // country is required on the Club schema but derived from the (optional)
  // League.country, so it can be absent for international/supranational
  // competitions. bulkWrite skips Mongoose validation, so we must reject these
  // up front rather than upsert a doc that violates the schema constraint.
  test("returns false when country is missing", () => {
    expect(isValidClubDoc({ ...validDoc, country: undefined })).toBe(false);
  });

  test("returns false when country is an empty string", () => {
    expect(isValidClubDoc({ ...validDoc, country: "" })).toBe(false);
  });
});
