/**
 * @file Checks the demo data set is consistent and the seed script's target
 * guard. Loading it into MongoDB is covered by seedDemo.db.test.js (CI).
 */

const demo = require("../../../src/jobs/demo/demoData");
const { checkTarget } = require("../../../src/jobs/seedDemo");

describe("demo data", () => {
  const clubIds = new Set(demo.CLUBS.map((c) => c.clubId));
  const playerIds = new Set(demo.PLAYERS.map((p) => p.playerId));
  const periods = new Set(demo.SEASONS.map((s) => `${s.start.slice(0, 4)}/${s.end.slice(0, 4)}`));

  it("only refers to clubs, players and seasons it defines", () => {
    for (const t of demo.TRANSFERS) {
      expect(playerIds).toContain(t.player);
      expect(clubIds).toContain(t.buyer);
      if (t.seller) expect(clubIds).toContain(t.seller);
      expect(periods).toContain(t.season);
    }
    for (const v of demo.VALUATIONS) expect(playerIds).toContain(v.player);
  });

  it("files each transfer under the season of its window (July to June)", () => {
    for (const t of demo.TRANSFERS) {
      const date = new Date(t.date);
      const startYear = date.getUTCMonth() >= 6 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
      expect(`${t.player} ${t.date} ${t.season}`).toBe(`${t.player} ${t.date} ${startYear}/${startYear + 1}`);
    }
  });

  it("has unique natural keys and one valuation per player and date", () => {
    expect(clubIds.size).toBe(demo.CLUBS.length);
    expect(playerIds.size).toBe(demo.PLAYERS.length);
    const valuationKeys = demo.VALUATIONS.map((v) => `${v.player}|${v.date}`);
    expect(new Set(valuationKeys).size).toBe(valuationKeys.length);
  });

  it("centres on Olympique Lyonnais", () => {
    expect(demo.CLUBS.find((c) => c.clubId === "1041")).toMatchObject({ name: "Olympique Lyonnais", inLeague: true });
  });
});

describe("checkTarget", () => {
  it("needs MONGODB_URI", () => {
    expect(checkTarget(undefined, {})).toMatch(/MONGODB_URI is not set/);
  });

  it("accepts a local database", () => {
    expect(checkTarget("mongodb://127.0.0.1:27017", {})).toBeNull();
  });

  it("refuses a remote database unless SEED_ALLOW_REMOTE=1", () => {
    expect(checkTarget("mongodb+srv://user:pw@cluster.example.net", {})).toMatch(/remote database/);
    expect(checkTarget("mongodb+srv://user:pw@cluster.example.net", { SEED_ALLOW_REMOTE: "1" })).toBeNull();
  });
});
