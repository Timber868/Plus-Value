/**
 * @file Unit tests for the player search helpers. These run without MongoDB;
 * the aggregation itself is exercised against an in-memory MongoDB in
 * playerSearchService.db.test.js.
 */

jest.mock("../../../src/models/Person", () => ({ aggregate: jest.fn() }));
jest.mock("../../../src/services/marketValueCutoff", () => ({
  ...jest.requireActual("../../../src/services/marketValueCutoff"),
  getCurrentValueCutoff: jest.fn(),
}));

const Person = require("../../../src/models/Person");
const { getCurrentValueCutoff } = require("../../../src/services/marketValueCutoff");
const {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  buildNameRegex,
  parseSearchParams,
  buildSearchPipeline,
  toSearchResult,
  searchPlayers,
} = require("../../../src/services/playerSearchService");

describe("buildNameRegex", () => {
  it("matches regardless of case", () => {
    expect(buildNameRegex("LACAZETTE").test("Alexandre Lacazette")).toBe(true);
  });

  it("matches accented names from an unaccented query", () => {
    expect(buildNameRegex("mbappe").test("Kylian Mbappé")).toBe(true);
    expect(buildNameRegex("cherki").test("Rayan Cherki")).toBe(true);
  });

  it("matches accented names from an accented query", () => {
    expect(buildNameRegex("Tolisso Corentin").test("Tolisso Corentin")).toBe(true);
    expect(buildNameRegex("Mbappé").test("Kylian Mbappe")).toBe(true);
  });

  it("escapes regex characters in the query", () => {
    const regex = buildNameRegex("a.b");
    expect(regex.test("a.b")).toBe(true);
    expect(regex.test("axb")).toBe(false);
  });

  it("does not match unrelated names", () => {
    expect(buildNameRegex("lacazette").test("Rayan Cherki")).toBe(false);
  });
});

describe("parseSearchParams", () => {
  const clubId = "507f1f77bcf86cd799439011";

  it("applies the default limit and no club filter", () => {
    expect(parseSearchParams({ q: " lac " })).toEqual({ query: "lac", clubId: null, limit: DEFAULT_LIMIT });
  });

  it("rejects a missing or too short query", () => {
    expect(parseSearchParams({})).toEqual({ error: expect.stringContaining("q") });
    expect(parseSearchParams({ q: "a" })).toEqual({ error: expect.stringContaining("q") });
    expect(parseSearchParams({ q: ["ab", "cd"] })).toEqual({ error: expect.stringContaining("q") });
  });

  it("accepts a valid club id", () => {
    expect(parseSearchParams({ q: "lac", club: clubId }).clubId).toBe(clubId);
  });

  it("rejects an invalid club id", () => {
    expect(parseSearchParams({ q: "lac", club: "nope" })).toEqual({ error: "Invalid club" });
  });

  it("caps the limit at the maximum", () => {
    expect(parseSearchParams({ q: "lac", limit: "500" }).limit).toBe(MAX_LIMIT);
    expect(parseSearchParams({ q: "lac", limit: "5" }).limit).toBe(5);
  });

  it("rejects a limit that is not a positive integer", () => {
    expect(parseSearchParams({ q: "lac", limit: "0" })).toEqual({ error: "Invalid limit" });
    expect(parseSearchParams({ q: "lac", limit: "2.5" })).toEqual({ error: "Invalid limit" });
    expect(parseSearchParams({ q: "lac", limit: "abc" })).toEqual({ error: "Invalid limit" });
  });
});

describe("buildSearchPipeline", () => {
  it("filters on the current club only when a club is given", () => {
    const withoutClub = buildSearchPipeline({ query: "lac", clubId: null, limit: 5 });
    const withClub = buildSearchPipeline({ query: "lac", clubId: "507f1f77bcf86cd799439011", limit: 5 });

    const hasClubMatch = (pipeline) => pipeline.some((stage) => stage.$match && stage.$match["currentClub._id"]);
    expect(hasClubMatch(withoutClub)).toBe(false);
    expect(hasClubMatch(withClub)).toBe(true);
    expect(withClub.length).toBe(withoutClub.length + 1);
  });

  it("starts with the name match and applies the limit", () => {
    const pipeline = buildSearchPipeline({ query: "lac", clubId: null, limit: 7 });

    expect(pipeline[0].$match.name).toBeInstanceOf(RegExp);
    expect(pipeline).toContainEqual({ $limit: 7 });
  });
});

describe("toSearchResult", () => {
  const cutoff = new Date("2024-01-01");
  const row = {
    name: "Alexandre Lacazette",
    nationality: "France",
    player: { _id: "p1", position: "Attack", subPosition: "Centre-Forward" },
    currentClub: [{ _id: "c1", name: "Olympique Lyonnais" }],
    latestMarketValue: [{ value: 5000000, date: new Date("2024-06-01") }],
  };

  it("shapes a row with a club and a market value", () => {
    expect(toSearchResult(row, cutoff)).toEqual({
      id: "p1",
      name: "Alexandre Lacazette",
      nationality: "France",
      position: "Attack",
      subPosition: "Centre-Forward",
      currentClub: { id: "c1", name: "Olympique Lyonnais" },
      latestMarketValue: { value: 5000000, date: new Date("2024-06-01") },
    });
  });

  it("returns null club and market value when there are none", () => {
    const result = toSearchResult({ ...row, currentClub: [], latestMarketValue: [] }, cutoff);

    expect(result.currentClub).toBeNull();
    expect(result.latestMarketValue).toBeNull();
  });

  it("returns a null market value when it is older than the last market window", () => {
    const retired = { ...row, latestMarketValue: [{ value: 500000, date: new Date("2018-06-01") }] };

    expect(toSearchResult(retired, cutoff).latestMarketValue).toBeNull();
  });
});

describe("searchPlayers", () => {
  it("runs the pipeline on the Person collection and shapes the rows", async () => {
    getCurrentValueCutoff.mockResolvedValue(new Date("2024-01-01"));
    Person.aggregate.mockResolvedValue([
      { name: "A", nationality: "France", player: { _id: "p1" }, currentClub: [], latestMarketValue: [] },
    ]);

    const results = await searchPlayers({ query: "ab", clubId: null, limit: 5 });

    expect(Person.aggregate).toHaveBeenCalledWith(expect.any(Array));
    expect(results).toEqual([
      { id: "p1", name: "A", nationality: "France", position: null, subPosition: null, currentClub: null, latestMarketValue: null },
    ]);
  });
});
