const { HICP, createIndex, defaultInflation, adjustAmount, adjustGain, describeInflation } = require("../../../src/services/inflation");

const index = createIndex({ name: "test", values: { 2020: 100, 2021: 110, 2026: 140 } });
const inflation = { index, referenceYear: 2026 };

describe("adjustAmount", () => {
  it("brings 10M from 2020 into 2026 money (known case)", () => {
    expect(adjustAmount(10000000, new Date("2020-07-01"), inflation)).toBe(14000000);
  });

  it("keeps null and amounts already in the reference year", () => {
    expect(adjustAmount(null, new Date("2020-07-01"), inflation)).toBeNull();
    expect(adjustAmount(5000000, new Date("2026-01-01"), inflation)).toBe(5000000);
  });

  it("uses the nearest year of the table outside its range", () => {
    expect(adjustAmount(1000, new Date("2015-01-01"), inflation)).toBe(1400);
    expect(adjustAmount(1000, new Date("2030-01-01"), inflation)).toBe(1000);
  });
});

describe("adjustGain", () => {
  it("shows that buying for 10M in 2020 and selling for 14M in 2026 is no real gain", () => {
    expect(
      adjustGain({ cost: 10000000, costDate: new Date("2020-07-01"), value: 14000000, valueDate: new Date("2026-07-01") }, inflation),
    ).toEqual({ cost: 14000000, value: 14000000, gain: 0, roiPercent: 0 });
  });

  it("has no gain when an amount is unknown, and no ROI for a free signing", () => {
    expect(adjustGain({ cost: null, costDate: null, value: 5, valueDate: null }, inflation).gain).toBeNull();
    expect(adjustGain({ cost: 0, costDate: new Date("2021-01-01"), value: 1100, valueDate: new Date("2021-06-01") }, inflation)).toEqual({
      cost: 0,
      value: 1400,
      gain: 1400,
      roiPercent: null,
    });
  });
});

describe("HICP", () => {
  it("defaults to the latest HICP year", () => {
    const settings = defaultInflation();
    expect(settings.index).toBe(HICP);
    expect(settings.referenceYear).toBe(HICP.lastYear);
    expect(describeInflation(settings)).toEqual({ index: "hicp", referenceYear: HICP.lastYear });
  });

  it("has a value for every year from 2000 to its last year, with 2015 = 100", () => {
    expect(HICP.firstYear).toBe(2000);
    expect(HICP.valueFor(2015)).toBe(100);
    for (let year = 2000; year <= HICP.lastYear; year += 1) expect(HICP.valueFor(year)).toBeGreaterThan(0);
  });
});
