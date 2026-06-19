/**
 * @file Unit tests for the pure season-shaping helper. Transfermarkt encodes a
 * season as a single start year (e.g. "2025" == the 2025/2026 campaign). We
 * map that to a fixed Aug 1 -> May 31 window and a "<year>/<year+1>" period.
 *
 * The period is computed here (not via the Season pre("validate") hook),
 * because the season upsert uses findOneAndUpdate, which bypasses document
 * middleware. These tests pin the format the service relies on.
 */

const { toSeason } = require("../../../../src/etl/mappers/seasonMapper");

describe("toSeason", () => {
  test('maps "2025" to an Aug 1 2025 -> May 31 2026 window', () => {
    const { startDate, endDate } = toSeason("2025");
    expect(startDate.toISOString()).toBe("2025-08-01T00:00:00.000Z");
    expect(endDate.toISOString()).toBe("2026-05-31T00:00:00.000Z");
  });

  test('derives the period as "2025/2026"', () => {
    expect(toSeason("2025").period).toBe("2025/2026");
  });

  test("accepts a numeric year as well as a string", () => {
    expect(toSeason(2022).period).toBe("2022/2023");
    expect(toSeason(2022).startDate.getUTCFullYear()).toBe(2022);
  });

  test("returns dates as Date instances", () => {
    const { startDate, endDate } = toSeason("2025");
    expect(startDate).toBeInstanceOf(Date);
    expect(endDate).toBeInstanceOf(Date);
  });

  // The window must satisfy the Season schema validators: endDate after
  // startDate, and a span of no more than one year.
  test("produces a window under one year and end after start", () => {
    const { startDate, endDate } = toSeason("2025");
    const oneYearMs = 366 * 24 * 60 * 60 * 1000;
    expect(endDate.getTime()).toBeGreaterThan(startDate.getTime());
    expect(endDate.getTime() - startDate.getTime()).toBeLessThanOrEqual(oneYearMs);
  });

  test("throws for a non-numeric year", () => {
    expect(() => toSeason("not-a-year")).toThrow();
  });
});
