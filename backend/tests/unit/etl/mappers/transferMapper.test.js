/**
 * @file Unit tests for the pure transformations that shape a transfers reader
 * row toward the Transfer model: the "YY/YY" → "YYYY/YYYY" season period
 * expansion (with its century pivot), the transfer window derived from the
 * date's month, the external-club doc, and the validation gate.
 */

const {
  toSeasonPeriod,
  toWindow,
  toTransferDoc,
  isValidTransferDoc,
  toExternalClubDoc,
} = require("../../../../src/etl/mappers/transferMapper");

describe("toSeasonPeriod", () => {
  test("expands a 2000s season", () => {
    expect(toSeasonPeriod("24/25")).toBe("2024/2025");
  });

  test("expands a 1990s season", () => {
    expect(toSeasonPeriod("93/94")).toBe("1993/1994");
  });

  test("handles the century rollover season", () => {
    expect(toSeasonPeriod("99/00")).toBe("1999/2000");
  });

  test("handles the first 2000s season", () => {
    expect(toSeasonPeriod("00/01")).toBe("2000/2001");
  });
});

describe("toWindow", () => {
  test.each([
    ["2024-06-15", "summer"],
    ["2024-07-01", "summer"],
    ["2024-08-31", "summer"],
    ["2024-09-01", "summer"],
  ])("%s falls in the summer window", (date, expected) => {
    expect(toWindow(new Date(date))).toBe(expected);
  });

  test.each([
    ["2024-12-31", "winter"],
    ["2025-01-15", "winter"],
    ["2025-02-01", "winter"],
  ])("%s falls in the winter window", (date, expected) => {
    expect(toWindow(new Date(date))).toBe(expected);
  });

  test("returns undefined outside both windows", () => {
    expect(toWindow(new Date("2024-04-10"))).toBeUndefined();
    expect(toWindow(new Date("2024-11-10"))).toBeUndefined();
  });
});

describe("toTransferDoc", () => {
  const readerRow = {
    playerId: "1",
    date: "2024-08-15",
    season: "24/25",
    sellerClubId: "99",
    buyerClubId: "10",
    sellerName: "Real Madrid",
    buyerName: "Paris SG",
    fee: 180000000,
  };

  test("shapes the row with an expanded period, Date, price and window", () => {
    expect(toTransferDoc(readerRow)).toEqual({
      playerId: "1",
      buyerClubId: "10",
      sellerClubId: "99",
      buyerName: "Paris SG",
      sellerName: "Real Madrid",
      seasonPeriod: "2024/2025",
      date: new Date("2024-08-15T00:00:00.000Z"),
      price: 180000000,
      window: "summer",
    });
  });

  test("maps a null fee to an undefined price (free transfer)", () => {
    const doc = toTransferDoc({ ...readerRow, fee: null });
    expect(doc.price).toBeUndefined();
  });

  test("keeps a zero fee as a zero price", () => {
    const doc = toTransferDoc({ ...readerRow, fee: 0 });
    expect(doc.price).toBe(0);
  });
});

describe("isValidTransferDoc", () => {
  const validDoc = {
    playerId: "1",
    buyerClubId: "10",
    sellerClubId: "99",
    seasonPeriod: "2024/2025",
    date: new Date("2024-08-15"),
  };

  test("accepts a doc with every required field", () => {
    expect(isValidTransferDoc(validDoc)).toBe(true);
  });

  test("accepts a doc without a seller (youth signing)", () => {
    expect(isValidTransferDoc({ ...validDoc, sellerClubId: null })).toBe(true);
  });

  test("rejects a missing playerId, buyer, date or period", () => {
    expect(isValidTransferDoc({ ...validDoc, playerId: "" })).toBe(false);
    expect(isValidTransferDoc({ ...validDoc, buyerClubId: null })).toBe(false);
    expect(isValidTransferDoc({ ...validDoc, date: null })).toBe(false);
    expect(isValidTransferDoc({ ...validDoc, seasonPeriod: "" })).toBe(false);
  });
});

describe("toExternalClubDoc", () => {
  test("builds a minimal club doc with an Unknown country", () => {
    expect(toExternalClubDoc("88", "Chelsea")).toEqual({
      clubId: "88",
      name: "Chelsea",
      country: "Unknown",
    });
  });
});
