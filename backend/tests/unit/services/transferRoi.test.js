const {
  valueOnOrBefore,
  latestValue,
  isLoan,
  loanStatus,
  findExit,
  computeTransferRoi,
  computeSaleResult,
  conversionOf,
  loanInFeeOf,
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

describe("only a move the club sold can be a resale (ECS-169)", () => {
  const signing = { date: d("2022-07-01"), fee: 15e6, seller: "x", buyer: "ol" };
  const cutoff = d("2022-09-01");

  it("ends the stay with no value when another club sells the player on", () => {
    const onward = { date: d("2023-07-01"), fee: 28.5e6, seller: "x", buyer: "y" };
    const exit = findExit(signing, [signing, onward]);
    const roi = computeTransferRoi({ transfer: signing, valuations, ...exit, currentCutoff: cutoff });

    expect(roi.exit).toEqual({ type: "left", value: null, date: d("2023-07-01"), loanFees: 0 });
    expect(roi.gain).toBeNull();
    expect(roi.roiPercent).toBeNull();
  });

  it("keeps the loan fees earned before such a move", () => {
    const loanOut = { date: d("2023-01-10"), fee: 1e6, seller: "ol", buyer: "z" };
    const back = { date: d("2023-06-30"), fee: 0, seller: "z", buyer: "ol" };
    const onward = { date: d("2023-08-01"), fee: 5e6, seller: "w", buyer: "y" };
    const exit = findExit(signing, [signing, loanOut, back, onward]);
    const roi = computeTransferRoi({ transfer: signing, valuations, ...exit, currentCutoff: cutoff });

    expect(roi.exit).toEqual({ type: "left", value: null, date: d("2023-08-01"), loanFees: 1e6 });
  });

  it("still values a sale by the club at its fee", () => {
    const sale = { date: d("2024-01-10"), fee: 45e6, seller: "ol", buyer: "y" };
    const exit = findExit(signing, [signing, sale]);
    const roi = computeTransferRoi({ transfer: signing, valuations, ...exit, currentCutoff: cutoff });

    expect(roi.exit).toEqual({ type: "resale", value: 45e6, date: d("2024-01-10"), loanFees: 0 });
    expect(roi.gain).toBe(30e6);
  });
});

describe("loan then purchase", () => {
  const loan = { date: d("2024-02-01"), fee: 2e6, seller: "nfo", buyer: "ol" };
  const back = { date: d("2024-06-30"), fee: 0, seller: "ol", buyer: "nfo" };
  const purchase = { date: d("2024-07-02"), fee: 17.5e6, seller: "nfo", buyer: "ol" };

  it("finds the purchase after the loan's return, or straight after the loan", () => {
    expect(conversionOf(loan, [loan, back, purchase])).toBe(purchase);
    expect(conversionOf(loan, [loan, purchase])).toBe(purchase);
    expect(loanInFeeOf(purchase, [loan, back, purchase])).toBe(2e6);
    expect(loanInFeeOf(purchase, [loan, purchase])).toBe(2e6);
  });

  it("ignores a purchase long after the loan ended, or from another club", () => {
    const late = { ...purchase, date: d("2025-01-31") };
    expect(conversionOf(loan, [loan, back, late])).toBeNull();
    expect(loanInFeeOf(late, [loan, back, late])).toBe(0);
    const other = { ...purchase, seller: "eve" };
    expect(conversionOf(loan, [loan, back, other])).toBeNull();
  });

  it("counts an unknown loan fee as 0", () => {
    const freeLoan = { ...loan, fee: null };
    expect(loanInFeeOf(purchase, [freeLoan, back, purchase])).toBe(0);
  });

  it("adds the loan fee to the cost of the purchase, for a buyer and for a later sale", () => {
    const roi = computeTransferRoi({ transfer: purchase, valuations: [], exitTransfer: null, loanInFee: 2e6, currentCutoff: null });
    expect(roi.feePaid).toBe(19.5e6);
    const sale = { date: d("2026-07-01"), fee: 25e6, seller: "ol", buyer: "rom" };
    expect(computeSaleResult(sale, [loan, back, purchase, sale])).toMatchObject({ sellerCost: 19.5e6, gain: 5.5e6, homegrown: false });
  });
});

describe("computeSaleResult and the reserve team", () => {
  it("reads a player who came up from the reserve team for no known fee as formed by the club", () => {
    const up = { date: d("2019-07-01"), fee: 0, reserveTeamMove: true, seller: "olb", buyer: "ol" };
    const sale = { date: d("2025-07-01"), fee: 36.5e6, seller: "ol", buyer: "mci" };
    expect(computeSaleResult(sale, [up, sale])).toMatchObject({ homegrown: true, sellerCost: 0, gain: 36.5e6, signingDate: null });
  });

  it("keeps a paid move from the reserve team as a signing", () => {
    const up = { date: d("2019-07-01"), fee: 1e6, reserveTeamMove: true, seller: "olb", buyer: "ol" };
    const sale = { date: d("2025-07-01"), fee: 10e6, seller: "ol", buyer: "mci" };
    expect(computeSaleResult(sale, [up, sale])).toMatchObject({ homegrown: false, sellerCost: 1e6 });
  });
});
