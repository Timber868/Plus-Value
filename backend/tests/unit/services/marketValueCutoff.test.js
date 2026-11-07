jest.mock("../../../src/models/MarketValue", () => ({ findOne: jest.fn() }));

const MarketValue = require("../../../src/models/MarketValue");
const {
  MARKET_WINDOW_MONTHS,
  computeCutoff,
  getCurrentValueCutoff,
  currentOrNull,
} = require("../../../src/services/marketValueCutoff");

describe("computeCutoff", () => {
  it("goes back one market window from the newest valuation", () => {
    expect(MARKET_WINDOW_MONTHS).toBe(6);
    expect(computeCutoff(new Date("2025-12-18T00:00:00Z"))).toEqual(new Date("2025-06-18T00:00:00Z"));
  });

  it("does not modify the given date", () => {
    const newest = new Date("2025-12-18T00:00:00Z");
    computeCutoff(newest);
    expect(newest).toEqual(new Date("2025-12-18T00:00:00Z"));
  });
});

describe("getCurrentValueCutoff", () => {
  function mockNewest(doc) {
    const chain = { sort: jest.fn(() => chain), lean: jest.fn().mockResolvedValue(doc) };
    MarketValue.findOne.mockReturnValue(chain);
    return chain;
  }

  it("uses the newest valuation in the collection", async () => {
    const chain = mockNewest({ date: new Date("2025-12-18T00:00:00Z") });

    expect(await getCurrentValueCutoff()).toEqual(new Date("2025-06-18T00:00:00Z"));
    expect(chain.sort).toHaveBeenCalledWith({ date: -1 });
  });

  it("returns null when there are no valuations", async () => {
    mockNewest(null);

    expect(await getCurrentValueCutoff()).toBeNull();
  });
});

describe("currentOrNull", () => {
  const cutoff = new Date("2025-06-18T00:00:00Z");

  it("keeps a value inside the last market window, including on the cutoff", () => {
    const recent = { value: 5000000, date: new Date("2025-12-18T00:00:00Z") };
    const onCutoff = { value: 1, date: cutoff };

    expect(currentOrNull(recent, cutoff)).toBe(recent);
    expect(currentOrNull(onCutoff, cutoff)).toBe(onCutoff);
  });

  it("drops a value from before the last market window", () => {
    expect(currentOrNull({ value: 500000, date: new Date("2018-06-01T00:00:00Z") }, cutoff)).toBeNull();
  });

  it("returns null without a value or without a cutoff", () => {
    expect(currentOrNull(null, cutoff)).toBeNull();
    expect(currentOrNull({ value: 1, date: new Date() }, null)).toBeNull();
  });
});
