/**
 * @file Unit tests for the pure transformation helpers that finish shaping a
 * reader row into a League document. Field renames and league/cup
 * classification are tested at the reader level (they live in SQL now); the
 * only logic owned by the mapper is `toTier` and `isValidLeagueDoc`.
 */

const {
  toTier,
  toLeagueDoc,
  isValidLeagueDoc,
} = require("../../../../src/etl/mappers/leagueMapper");

/** Extracts a 1-5 tier from the `sub_type` array, or undefined if none match. */
describe("toTier", () => {
  test("returns 1 for ['first_tier']", () => {
    expect(toTier(["first_tier"])).toBe(1);
  });

  test("returns 2 for ['second_tier']", () => {
    expect(toTier(["second_tier"])).toBe(2);
  });

  test("returns 3 for ['third_tier']", () => {
    expect(toTier(["third_tier"])).toBe(3);
  });

  test("returns 4 for ['fourth_tier']", () => {
    expect(toTier(["fourth_tier"])).toBe(4);
  });

  test("returns 5 for ['fifth_tier']", () => {
    expect(toTier(["fifth_tier"])).toBe(5);
  });

  test("returns undefined when no tier keyword is present", () => {
    expect(toTier(["random_qualifier"])).toBeUndefined();
  });

  test("returns undefined for an empty array", () => {
    expect(toTier([])).toBeUndefined();
  });

  // DuckDB sometimes returns sparse lists with nulls/empty strings mixed in;
  // those must not crash `.toLowerCase()` or shadow a real tier keyword.
  test("filters out null / undefined / empty entries before matching", () => {
    expect(toTier([null, undefined, "", "second_tier"])).toBe(2);
  });

  test("is case-insensitive: 'FIRST_TIER' -> 1", () => {
    expect(toTier(["FIRST_TIER"])).toBe(1);
  });

  // Ordering matters: the source data occasionally lists multiple tiers for
  // historical reasons, and we treat the first one as authoritative.
  test("returns the first match when multiple tier keywords appear", () => {
    expect(toTier(["first_tier", "second_tier"])).toBe(1);
  });
});

/** Adds `tier` to a reader row and strips the raw `sub_type` array. */
describe("toLeagueDoc", () => {
  // Mirrors the post-SQL row shape produced by `readCompetitions` — already
  // camelCase, already classified as league/cup, still carrying `sub_type`
  // so `toTier` can run.
  const readerRow = {
    competitionId: "FR1",
    name: "Ligue 1",
    country: "France",
    confederation: "UEFA",
    competitionFormat: "league",
    sub_type: ["first_tier"],
  };

  test("attaches tier and strips sub_type from the output", () => {
    expect(toLeagueDoc(readerRow)).toEqual({
      competitionId: "FR1",
      name: "Ligue 1",
      country: "France",
      confederation: "UEFA",
      competitionFormat: "league",
      tier: 1,
    });
  });

  test("leaves tier undefined when sub_type has no tier keyword", () => {
    const doc = toLeagueDoc({ ...readerRow, sub_type: ["knockout"] });
    expect(doc.tier).toBeUndefined();
  });

  test("forwards competitionFormat unchanged (already classified in SQL)", () => {
    const doc = toLeagueDoc({ ...readerRow, competitionFormat: "cup" });
    expect(doc.competitionFormat).toBe("cup");
  });

  // Guards against an accidental rename in the SQL ever silently regressing
  // the field-passthrough behaviour.
  test("preserves competitionId exactly", () => {
    const doc = toLeagueDoc({ ...readerRow, competitionId: "GB1" });
    expect(doc.competitionId).toBe("GB1");
  });

  test("does not leak sub_type into the output document", () => {
    const doc = toLeagueDoc(readerRow);
    expect(doc).not.toHaveProperty("sub_type");
  });
});

/** Skip-list filter — returns false for any doc the schema would reject. */
describe("isValidLeagueDoc", () => {
  const validDoc = {
    competitionId: "FR1",
    name: "Ligue 1",
    country: "France",
    confederation: "UEFA",
    competitionFormat: "league",
  };

  test("returns true when all required fields are present", () => {
    expect(isValidLeagueDoc(validDoc)).toBe(true);
  });

  test("returns false when competitionId is missing", () => {
    expect(isValidLeagueDoc({ ...validDoc, competitionId: undefined })).toBe(false);
  });

  // Empty strings pass `required: true` validation in Mongoose but would
  // collide on the unique index; treat them as invalid up front.
  test("returns false when competitionId is an empty string", () => {
    expect(isValidLeagueDoc({ ...validDoc, competitionId: "" })).toBe(false);
  });

  test("returns false when name is missing", () => {
    expect(isValidLeagueDoc({ ...validDoc, name: undefined })).toBe(false);
  });

  test("returns false when country is missing", () => {
    expect(isValidLeagueDoc({ ...validDoc, country: undefined })).toBe(false);
  });

  test("returns false when confederation is missing", () => {
    expect(isValidLeagueDoc({ ...validDoc, confederation: undefined })).toBe(false);
  });
});
