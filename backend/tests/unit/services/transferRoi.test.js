const {
  valueOnOrBefore,
  latestValue,
  isLoan,
  loanStatus,
  findExit,
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

describe("findExit", () => {
  // Bought by Lyon (L) from Gent (G); later moves to Everton (E), Roma (R), Leipzig (Z).
  const signing = { date: d("2021-07-01"), fee: 10e6, seller: "G", buyer: "L" };
  const move = (date, seller, buyer, fee = 0) => ({ date: d(date), seller, buyer, fee });

  it("returns the next move when it is a sale", () => {
    const sale = move("2023-07-01", "L", "R", 40e6);
    const transfers = [move("2024-01-10", "R", "Z", 50e6), signing, sale];

    expect(findExit(signing, transfers)).toEqual({ exitTransfer: sale, loanFees: 0 });
  });

  it("returns no exit for the player's last transfer", () => {
    expect(findExit(signing, [signing])).toEqual({ exitTransfer: null, loanFees: 0 });
  });

  it("skips a loan out and its return, and adds the loan fee", () => {
    const sale = move("2023-07-01", "L", "R", 10e6);
    const transfers = [signing, move("2022-07-01", "L", "E", 3e6), move("2023-06-30", "E", "L"), sale];

    expect(findExit(signing, transfers)).toEqual({ exitTransfer: sale, loanFees: 3e6 });
  });

  it("adds up several loans and counts a loan without a fee as 0", () => {
    const transfers = [
      signing,
      move("2021-08-31", "L", "E", 1e6),
      move("2022-06-30", "E", "L", null),
      move("2022-08-01", "L", "R", null),
      move("2023-06-30", "R", "L"),
    ];

    expect(findExit(signing, transfers)).toEqual({ exitTransfer: null, loanFees: 1e6 });
  });

  it("treats a move back with a fee as a buy-back, so the first move was a sale", () => {
    const sale = move("2022-07-01", "L", "E", 5e6);
    const transfers = [signing, sale, move("2023-07-01", "E", "L", 8e6)];

    expect(findExit(signing, transfers).exitTransfer).toBe(sale);
  });

  it("treats a return more than two years later as a sale and a new signing", () => {
    const sale = move("2022-07-01", "L", "E");
    const transfers = [signing, sale, move("2025-07-01", "E", "L")];

    expect(findExit(signing, transfers).exitTransfer).toBe(sale);
  });

  it("treats a move to a third club after a move out as a sale", () => {
    const sale = move("2022-07-01", "L", "E", 2e6);
    const transfers = [signing, sale, move("2023-06-30", "E", "R", 6e6)];

    expect(findExit(signing, transfers).exitTransfer).toBe(sale);
  });

  it("treats a loan that has not ended yet as a sale", () => {
    const loan = move("2022-07-01", "L", "E", 3e6);

    expect(findExit(signing, [signing, loan]).exitTransfer).toBe(loan);
  });

  it("treats a paid move followed by a loan back as a sale (Malo Gusto: Lyon to Chelsea 30M)", () => {
    const sale = move("2023-01-30", "L", "C", 30e6);
    const transfers = [signing, sale, move("2023-01-31", "C", "L"), move("2023-06-30", "L", "C")];

    expect(findExit(signing, transfers)).toEqual({ exitTransfer: sale, loanFees: 0 });
  });

  it("still counts a paid loan when the player does not rejoin the loaning club", () => {
    const sale = move("2023-07-01", "L", "R", 10e6);
    const transfers = [signing, move("2022-07-01", "L", "E", 3e6), move("2023-06-30", "E", "L"), sale];

    expect(findExit(signing, transfers)).toEqual({ exitTransfer: sale, loanFees: 3e6 });
  });

  it("compares club ids as strings", () => {
    const loan = { date: d("2022-07-01"), seller: { toString: () => "L" }, buyer: "E", fee: 0 };
    const back = { date: d("2023-06-30"), seller: "E", buyer: { toString: () => "L" }, fee: 0 };

    expect(isLoan(loan, back)).toBe(true);
    expect(findExit(signing, [signing, loan, back])).toEqual({ exitTransfer: null, loanFees: 0 });
  });
});

describe("loanStatus", () => {
  const move = (date, seller, buyer, fee = 0) => ({ date: d(date), seller, buyer, fee });
  const signing = move("2021-07-01", "G", "L", 10e6);
  const loanOut = move("2022-07-01", "L", "E", 3e6);
  const back = move("2023-06-30", "E", "L");
  const sale = move("2023-08-01", "L", "R", 10e6);
  const history = [sale, back, loanOut, signing];

  it("flags the start and the end of a loan", () => {
    expect(loanStatus(loanOut, history)).toEqual({ isLoan: true, isLoanReturn: false });
    expect(loanStatus(back, history)).toEqual({ isLoan: false, isLoanReturn: true });
  });

  it("flags the loan back of a sale as a loan, not as a loan return", () => {
    const sold = move("2023-01-30", "L", "C", 30e6);
    const loanBack = move("2023-01-31", "C", "L");
    const rejoin = move("2023-06-30", "L", "C");
    const gusto = [signing, sold, loanBack, rejoin];

    expect(loanStatus(sold, gusto)).toEqual({ isLoan: false, isLoanReturn: false });
    expect(loanStatus(loanBack, gusto)).toEqual({ isLoan: true, isLoanReturn: false });
    expect(loanStatus(rejoin, gusto)).toEqual({ isLoan: false, isLoanReturn: true });
  });

  it("orders a sale and its loan back on the same day, paid move first", () => {
    const sold = move("2023-01-30", "L", "C", 30e6);
    const loanBack = move("2023-01-30", "C", "L");
    const rejoin = move("2023-06-30", "L", "C");
    // Loan back listed first, as the data may give it
    const gusto = [signing, loanBack, sold, rejoin];

    expect(loanStatus(sold, gusto)).toEqual({ isLoan: false, isLoanReturn: false });
    expect(loanStatus(loanBack, gusto)).toEqual({ isLoan: true, isLoanReturn: false });
    expect(loanStatus(rejoin, gusto)).toEqual({ isLoan: false, isLoanReturn: true });
    expect(findExit(signing, gusto).exitTransfer).toBe(sold);
  });

  it("matches a copy of a transfer by date, buyer and seller", () => {
    expect(loanStatus({ ...loanOut }, history)).toEqual({ isLoan: true, isLoanReturn: false });
  });

  it("flags neither for a permanent move", () => {
    expect(loanStatus(signing, history)).toEqual({ isLoan: false, isLoanReturn: false });
    expect(loanStatus(sale, history)).toEqual({ isLoan: false, isLoanReturn: false });
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
      exit: { type: "resale", value: 45e6, date: d("2024-01-10"), loanFees: 0 },
      gain: 30e6,
      roiPercent: 200,
    });
  });

  it("uses the latest current valuation when the player is still at the club", () => {
    const roi = computeTransferRoi({ transfer, valuations, exitTransfer: null, currentCutoff: cutoff });

    expect(roi.exit).toEqual({ type: "marketValue", value: 30e6, date: d("2022-12-01"), loanFees: 0 });
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

    expect(roi.exit).toEqual({ type: "marketValue", value: null, date: null, loanFees: 0 });
    expect(roi.gain).toBeNull();
    expect(roi.roiPercent).toBeNull();
  });

  it("treats a valuation older than one market window before the signing as unknown", () => {
    const roi = computeTransferRoi({
      transfer: { date: d("2023-07-01"), fee: 15e6 },
      valuations: [{ date: d("2022-06-01"), value: 20e6 }],
      exitTransfer: null,
      currentCutoff: cutoff,
    });

    expect(roi.marketValueAtSigning).toBeNull();
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

  it("adds loan fees to the resale fee (bought 10M, loaned for 3M, sold 10M: +3M)", () => {
    const roi = computeTransferRoi({
      transfer: { date: d("2022-07-01"), fee: 10e6 },
      valuations,
      exitTransfer: { date: d("2024-07-01"), fee: 10e6 },
      loanFees: 3e6,
      currentCutoff: cutoff,
    });

    expect(roi.exit).toEqual({ type: "resale", value: 13e6, date: d("2024-07-01"), loanFees: 3e6 });
    expect(roi.gain).toBe(3e6);
    expect(roi.roiPercent).toBe(30);
  });

  it("adds loan fees to the current value when the player never left", () => {
    const roi = computeTransferRoi({ transfer, valuations, exitTransfer: null, loanFees: 2e6, currentCutoff: cutoff });

    expect(roi.exit.value).toBe(32e6);
    expect(roi.gain).toBe(17e6);
  });

  it("keeps the exit unknown when the resale fee is unknown, even with loan fees", () => {
    const roi = computeTransferRoi({
      transfer,
      valuations,
      exitTransfer: { date: d("2024-07-01"), fee: null },
      loanFees: 3e6,
      currentCutoff: cutoff,
    });

    expect(roi.exit.value).toBeNull();
    expect(roi.gain).toBeNull();
  });
});
