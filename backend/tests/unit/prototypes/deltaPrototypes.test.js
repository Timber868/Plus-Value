const fs = require("fs");
const path = require("path");

const { parseAmount, parseTransferType, keepSince } = require("../../../src/prototypes/delta/common");
const wikipedia = require("../../../src/prototypes/delta/wikipedia");
const apiFootball = require("../../../src/prototypes/delta/apiFootball");
const amf = require("../../../src/prototypes/delta/amfReleases");
const { parseArgs } = require("../../../src/prototypes/delta/run");

const fixture = (name) => fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8");

/** A fetch that answers from a table of URLs, so no request leaves the test */
function fakeFetch(table) {
  return async (url) => {
    if (!(url in table)) return { ok: false, status: 404, statusText: "Not Found" };
    const body = table[url];
    return {
      ok: true,
      json: async () => body,
      text: async () => body,
      arrayBuffer: async () => Buffer.from(String(body)),
    };
  };
}

describe("delta prototypes: shared helpers", () => {
  it("reads amounts in English and French", () => {
    expect(parseAmount("€ 12M")).toBe(12000000);
    expect(parseAmount("€750K")).toBe(750000);
    expect(parseAmount("33.6 million")).toBe(33600000);
    expect(parseAmount("12,5 millions")).toBe(12500000);
    expect(parseAmount("N/A")).toBeNull();
  });

  it("reads API-Football transfer types", () => {
    expect(parseTransferType("€ 12M")).toEqual({ fee: 12000000, isLoan: false, isLoanReturn: false });
    expect(parseTransferType("Loan")).toEqual({ fee: null, isLoan: true, isLoanReturn: false });
    expect(parseTransferType("Free")).toEqual({ fee: 0, isLoan: false, isLoanReturn: false });
    expect(parseTransferType("Back from Loan").isLoanReturn).toBe(true);
    expect(parseTransferType("N/A").fee).toBeNull();
  });

  it("keeps undated records and those on or after the date", () => {
    const rows = [{ date: "2026-06-01" }, { date: "2026-07-01" }, { date: null }];
    expect(keepSince(rows, "2026-06-30")).toEqual([{ date: "2026-07-01" }, { date: null }]);
  });
});

describe("delta prototypes: Wikipedia", () => {
  const url = "https://en.wikipedia.org/wiki/List_of_French_football_transfers_summer_2026";
  const records = wikipedia.parseWikitext(fixture("wikipedia-summer-2026.wikitext"), url);

  it("reads moves in and out of each club, with loans and releases", () => {
    const byName = Object.fromEntries(records.map((r) => [r.playerName, r]));
    expect(byName["Keito Nakamura"]).toMatchObject({ fromClub: "Reims", toClub: "Lyon", isLoan: false, league: "Ligue 1", sourceUrl: url });
    expect(byName["Zachary Athekame"]).toMatchObject({ fromClub: "Milan", toClub: "Lyon", isLoan: true });
    expect(byName["Noham Kamara"]).toMatchObject({ fromClub: "Paris Saint-Germain", toClub: "Lyon", feeText: "previously on loan" });
    expect(byName["Martín Satriano"]).toMatchObject({ fromClub: "Lyon", toClub: "Getafe", isLoan: true });
    expect(byName["Mathieu Gorgelin"]).toMatchObject({ fromClub: "Lyon", toClub: null, fee: 0, feeText: "released" });
  });

  it("reads plain wikitable rows and the Ligue 2 section", () => {
    const byName = Object.fromEntries(records.map((r) => [r.playerName, r]));
    expect(byName["Jean Exemple"]).toMatchObject({ fromClub: "Lorient", toClub: "Paris FC" });
    expect(byName["Georges Exemple"]).toMatchObject({ fromClub: "Metz", toClub: "Lyon", league: "Ligue 2" });
    expect(records).toHaveLength(7);
    expect(records.every((r) => r.date === null)).toBe(true);
  });

  it("asks the MediaWiki API for each window's wikitext", async () => {
    const title = "List of French football transfers summer 2026";
    const fetchImpl = fakeFetch({ [wikipedia.wikitextUrl(title)]: { parse: { wikitext: fixture("wikipedia-summer-2026.wikitext") } } });
    const found = await wikipedia.collect({ windows: ["summer 2026"], fetchImpl });
    expect(found).toHaveLength(7);
  });
});

describe("delta prototypes: API-Football", () => {
  const body = JSON.parse(fixture("api-football-transfers.json"));

  it("reads each transfer with its date, clubs and fee, and skips loan returns", () => {
    const records = apiFootball.parseTransfers(body, "u");
    expect(records).toHaveLength(4);
    expect(records[0]).toMatchObject({ playerName: "Keito Nakamura", sourcePlayerId: "35845", date: "2026-07-15", fromClub: "Reims", toClub: "Lyon", fee: 12000000, feeText: "€ 12M" });
    expect(records.find((r) => r.date === "2026-08-10")).toMatchObject({ isLoan: true, fee: null });
  });

  it("lists the league's teams, asks each team and keeps moves after the date once", async () => {
    const fetchImpl = fakeFetch({
      [apiFootball.teamsUrl(61, 2026)]: { response: [{ team: { id: 80, name: "Lyon" } }, { team: { id: 93, name: "Reims" } }] },
      [apiFootball.transfersUrl(80)]: body,
      [apiFootball.transfersUrl(93)]: { response: [body.response[0]] },
    });
    const records = await apiFootball.collect({ apiKey: "k", leagueIds: [61], season: 2026, since: "2026-06-30", fetchImpl });
    expect(records.map((r) => `${r.playerName} ${r.date}`).sort()).toEqual([
      "Keito Nakamura 2026-07-15",
      "Zachary Athekame 2026-08-10",
      "Zachary Athekame 2026-09-01",
    ]);
  });

  it("refuses to run without a key and stops before the daily quota", async () => {
    await expect(apiFootball.collect({ leagueIds: [61], season: 2026 })).rejects.toThrow("API_FOOTBALL_KEY");
    const fetchImpl = fakeFetch({
      [apiFootball.teamsUrl(61, 2026)]: { response: [{ team: { id: 80 } }, { team: { id: 81 } }] },
      [apiFootball.transfersUrl(80)]: { response: [] },
    });
    await expect(apiFootball.collect({ apiKey: "k", leagueIds: [61], season: 2026, fetchImpl, maxRequests: 2 })).rejects.toThrow("quota");
  });
});

describe("delta prototypes: AMF releases", () => {
  const file = { url: "https://echanges.dila.gouv.fr/OPENDATA/AMF/ACT/2026/06/FCACT080148_20260618.pdf", date: "2026-06-18" };

  it("reads the fee, add-ons and sell-on of an English release", () => {
    expect(amf.parseRelease(fixture("amf-release-en.txt"), file)).toMatchObject({
      source: "amf",
      playerName: "Afonso Moreira",
      date: "2026-06-18",
      fromClub: "Olympique Lyonnais",
      toClub: "Bayer 04 Leverkusen",
      isLoan: false,
      fee: 29500000,
      addOns: 4100000,
      sellOnPercent: 10,
    });
  });

  it("reads a French release", () => {
    expect(amf.parseRelease(fixture("amf-release-fr.txt"), file)).toMatchObject({
      playerName: "Jean Exemple",
      toClub: "Stade Rennais",
      fee: 10000000,
      addOns: 2500000,
      sellOnPercent: 15,
    });
  });

  it("ignores releases that are not about a transfer", () => {
    expect(amf.parseRelease(fixture("amf-release-other.txt"), file)).toBeNull();
  });

  it("lists a month's PDFs and keeps those in the date range", async () => {
    const listing = '<a href="FCACT080148_20260618.pdf">x</a> <a href="FCACT080001_20260602.pdf">y</a> <a href="readme.txt">z</a>';
    const base = amf.monthUrl(2026, 6);
    const fetchImpl = fakeFetch({ [base]: listing, [base + "FCACT080148_20260618.pdf"]: "pdf" });
    const texts = { pdf: fixture("amf-release-en.txt") };
    const records = await amf.collect({ since: "2026-06-10", until: "2026-06-30", fetchImpl, extractText: async (buf) => texts[buf.toString()] });
    expect(records.map((r) => r.playerName)).toEqual(["Afonso Moreira"]);
  });
});

describe("delta prototypes: command line", () => {
  it("reads the source and its options", () => {
    expect(parseArgs(["api-football", "--since", "2026-07-01", "--leagues", "61,62"])).toEqual({
      source: "api-football",
      options: { since: "2026-07-01", leagues: "61,62" },
    });
  });
});
