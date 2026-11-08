const { isReserveTeamPair, resolveFee } = require("../../../src/services/reserveTeam");

describe("isReserveTeamPair", () => {
  it.each([
    ["Olympique Lyon B", "Olympique Lyonnais"],
    ["Olympique Marseille B", "Olympique de Marseille"],
    ["Olympique Lyon U19", "Olympique Lyon"],
    ["Paris Saint-Germain", "Paris Saint-Germain B"],
    ["AS Monaco II", "AS Monaco"],
    ["Stade Rennais FC Réserve", "Stade Rennais FC"],
  ])("matches %s and %s", (a, b) => {
    expect(isReserveTeamPair(a, b)).toBe(true);
  });

  it.each([
    ["Olympique Lyonnais", "Olympique de Marseille"],
    ["Paris FC", "Paris Saint-Germain B"],
    ["Olympique Lyon", "Olympique Lyonnais"],
    ["Everton FC", "KV Mechelen B"],
    [null, "Olympique Lyon B"],
  ])("does not match %s and %s", (a, b) => {
    expect(isReserveTeamPair(a, b)).toBe(false);
  });
});

describe("resolveFee", () => {
  it("takes an unknown fee from a reserve team as 0", () => {
    expect(resolveFee(null, "Olympique Lyon B", "Olympique Lyonnais")).toEqual({ fee: 0, reserveTeamMove: true });
  });

  it("keeps a known fee and an unknown fee between different clubs", () => {
    expect(resolveFee(500000, "Olympique Lyon B", "Olympique Lyonnais")).toEqual({ fee: 500000, reserveTeamMove: true });
    expect(resolveFee(null, "Everton FC", "Olympique Lyonnais")).toEqual({ fee: null, reserveTeamMove: false });
  });
});
