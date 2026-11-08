const {
  valueOnOrBefore,
  latestValue,
  findExitTransfer,
  computeTransferRoi,
} = require("../../../src/services/transferRoi");

const d = (s) => new Date(`${s}T00:00:00Z`);

const valuations = [
  { date: d("2022-12-01"), value: 30e6 },
  { date: d("2021-06-01"), value: 10e6 },
  { date: d("2022-06-01"), value: 20e6 },
];

describe("valueOnOrBefore", () => {
  it("picks the closest valuation before the date", () => {
    expect(valueOnOrBefore(valuations, d("2022-08-15")).value).toBe(20e6);
  });

  it("counts a valuation on the same day", () => {
    expect(valueOnOrBefore(valuations, d("2022-06-01")).value).toBe(20e6);
  });

  it("returns null when every valuation is later", () => {
    expect(valueOnOrBefore(valuations, d("2020-01-01"))).toBeNull();
    expect(valueOnOrBefore([], d("2020-01-01"))).toBeNull();
  });
});

describe("latestValue", () => {
  it("returns the newest valuation or null", () => {
    expect(latestValue(valuations).value).toBe(30e6);
    expect(latestValue([])).toBeNull();
  });
});

describe("findExitTransfer", () => {
  const transfers = [
    { date: d("2024-01-10"), fee: 50e6 },
    { date: d("2021-07-01"), fee: 15e6 },
    { date: d("2023-07-01"), fee: 40e6 },
  ];

  it("returns the next transfer after the given one", () => {
    expect(findExitTransfer(transfers[1], transfers)).toBe(transfers[2]);
  });

  it("returns null for the player's last transfer", () => {
    expect(findExitTransfer(transfers[0], transfers)).toBeNull();
  });
});

describe("computeTransferRoi", () => {
  const transfer = { date: d("2022-07-01"), fee: 15e6 };
  const cutoff = d("2022-09-01");

  it("uses the resale fee when the player left the club", () => {
    const roi = computeTransferRoi({
      transfer,
      valuations,
      exitTransfer: { date: d("2024-01-10"), fee: 45e6 },
      currentCutoff: cutoff,
    });

    expect(roi).toEqual({
      feePaid: 15e6,
      marketValueAtSigning: { value: 20e6, date: d("2022-06-01") },
      exit: { type: "resale", value: 45e6, date: d("2024-01-10") },
      gain: 30e6,
      roiPercent: 200,
    });
  });

  it("uses the latest current valuation when the player is still at the club", () => {
    const roi = computeTransferRoi({ transfer, valuations, exitTransfer: null, currentCutoff: cutoff });

    expect(roi.exit).toEqual({ type: "marketValue", value: 30e6, date: d("2022-12-01") });
    expect(roi.gain).toBe(15e6);
    expect(roi.roiPercent).toBe(100);
  });

  it("treats a stale latest valuation as unknown", () => {
    const roi = computeTransferRoi({
      transfer,
      valuations,
      exitTransfer: null,
      currentCutoff: d("2023-06-01"),
    });

    expect(roi.exit).toEqual({ type: "marketValue", value: null, date: null });
    expect(roi.gain).toBeNull();
    expect(roi.roiPercent).toBeNull();
  });

  it("reports a loss as a negative gain and rounds the ROI to one decimal", () => {
    const roi = computeTransferRoi({
      transfer: { date: d("2022-07-01"), fee: 30e6 },
      valuations,
      exitTransfer: { date: d("2023-07-01"), fee: 10e6 },
      currentCutoff: cutoff,
    });

    expect(roi.gain).toBe(-20e6);
    expect(roi.roiPercent).toBe(-66.7);
  });

  it("gives no gain when the fee paid or the resale fee is unknown", () => {
    const unknownFee = computeTransferRoi({
      transfer: { date: d("2022-07-01"), fee: null },
      valuations,
      exitTransfer: null,
      currentCutoff: cutoff,
    });
    expect(unknownFee.feePaid).toBeNull();
    expect(unknownFee.gain).toBeNull();

    const unknownResale = computeTransferRoi({
      transfer,
      valuations,
      exitTransfer: { date: d("2023-07-01"), fee: null },
      currentCutoff: cutoff,
    });
    expect(unknownResale.exit.value).toBeNull();
    expect(unknownResale.gain).toBeNull();
  });

  it("keeps the gain but gives no percentage for a zero fee", () => {
    const roi = computeTransferRoi({
      transfer: { date: d("2022-07-01"), fee: 0 },
      valuations,
      exitTransfer: null,
      currentCutoff: cutoff,
    });

    expect(roi.feePaid).toBe(0);
    expect(roi.gain).toBe(30e6);
    expect(roi.roiPercent).toBeNull();
  });

  it("has no value at signing when the player had no valuation yet", () => {
    const roi = computeTransferRoi({
      transfer: { date: d("2020-07-01"), fee: 5e6 },
      valuations,
      exitTransfer: null,
      currentCutoff: cutoff,
    });

    expect(roi.marketValueAtSigning).toBeNull();
  });
});
