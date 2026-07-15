/**
 * @file Unit tests for the pure transformations that shape a valuations
 * reader row into a MarketValue document. Covers the date string → Date
 * conversion and the validation gate (zero is a legal value, negatives and
 * missing fields are not).
 */

const {
  toMarketValueDoc,
  isValidMarketValueDoc,
} = require("../../../../src/etl/mappers/marketValueMapper");

describe("toMarketValueDoc", () => {
  const readerRow = { playerId: "1", date: "2024-08-01", value: 150000000 };

  test("carries playerId and value through unchanged", () => {
    const doc = toMarketValueDoc(readerRow);
    expect(doc.playerId).toBe("1");
    expect(doc.value).toBe(150000000);
  });

  test("converts the date string to a UTC Date", () => {
    const doc = toMarketValueDoc(readerRow);
    expect(doc.date).toEqual(new Date("2024-08-01T00:00:00.000Z"));
  });

  test("produces exactly the three persisted fields", () => {
    expect(Object.keys(toMarketValueDoc(readerRow)).sort()).toEqual([
      "date",
      "playerId",
      "value",
    ]);
  });
});

describe("isValidMarketValueDoc", () => {
  const validDoc = {
    playerId: "1",
    date: new Date("2024-08-01"),
    value: 150000000,
  };

  test("accepts a doc with every required field", () => {
    expect(isValidMarketValueDoc(validDoc)).toBe(true);
  });

  test("accepts a zero value (free agents can be worth nothing)", () => {
    expect(isValidMarketValueDoc({ ...validDoc, value: 0 })).toBe(true);
  });

  test("rejects a negative value", () => {
    expect(isValidMarketValueDoc({ ...validDoc, value: -5 })).toBe(false);
  });

  test("rejects a missing or non-numeric value", () => {
    expect(isValidMarketValueDoc({ ...validDoc, value: null })).toBe(false);
    expect(isValidMarketValueDoc({ ...validDoc, value: undefined })).toBe(false);
    expect(isValidMarketValueDoc({ ...validDoc, value: "100" })).toBe(false);
  });

  test("rejects a missing or empty playerId", () => {
    expect(isValidMarketValueDoc({ ...validDoc, playerId: "" })).toBe(false);
    expect(isValidMarketValueDoc({ ...validDoc, playerId: null })).toBe(false);
  });

  test("rejects a missing date", () => {
    expect(isValidMarketValueDoc({ ...validDoc, date: null })).toBe(false);
  });
});
