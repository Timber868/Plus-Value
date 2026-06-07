/**
 * @file Unit tests for the pure ClubSeason-shaping helper. Joins a resolved
 * club id and season id with the seasonal points/standing into the shape of
 * the ClubSeason model.
 */

const { toClubSeasonDoc } = require("./clubSeasonMapper");

describe("toClubSeasonDoc", () => {
  test("builds a ClubSeason doc from ids, points and standing", () => {
    expect(
      toClubSeasonDoc({ club: "c1", season: "s1", points: 42, standing: 3 }),
    ).toEqual({ club: "c1", season: "s1", points: 42, standing: 3 });
  });

  // Points can legitimately be 0 (or negative after penalties); only a missing
  // value should fall back to 0.
  test("defaults points to 0 when undefined", () => {
    expect(
      toClubSeasonDoc({ club: "c1", season: "s1", standing: 1 }).points,
    ).toBe(0);
  });

  test("keeps a zero points value rather than treating it as missing", () => {
    expect(
      toClubSeasonDoc({ club: "c1", season: "s1", points: 0, standing: 18 })
        .points,
    ).toBe(0);
  });

  test("forwards standing unchanged", () => {
    expect(
      toClubSeasonDoc({ club: "c1", season: "s1", points: 10, standing: 7 })
        .standing,
    ).toBe(7);
  });
});
