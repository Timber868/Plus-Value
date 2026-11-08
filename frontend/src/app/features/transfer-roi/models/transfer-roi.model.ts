/** A club reference inside API responses */
export interface ClubRef {
  id: string;
  name: string;
}

/** One item of GET /api/clubs */
export interface ClubOption {
  id: string;
  name: string;
  country: string;
}

/** One item of GET /api/seasons (dates are ISO strings in JSON) */
export interface SeasonOption {
  id: string;
  /** Season label such as "2024-2025" */
  period: string;
  startDate: string;
  endDate: string;
  league: string;
}

/** How the buying club's stay with the player ended, or his value today */
export interface TransferExit {
  /** "resale": the player left for good; "marketValue": he never left */
  type: 'resale' | 'marketValue';
  /** Resale fee or current value, plus loan fees; null when unknown */
  value: number | null;
  date: string | null;
  /** Loan fees the club earned while the player was loaned out */
  loanFees: number;
}

/** One signing of GET /api/clubs/:id/transfers/roi */
export interface ClubTransferRoi {
  player: { id: string; name: string | null };
  date: string;
  /** Null when the dataset has no selling club (e.g. a youth signing) */
  fromClub: ClubRef | null;
  /** True when the club took the player on loan */
  isLoan: boolean;
  /** Null when the fee is unknown (free or undisclosed) */
  feePaid: number | null;
  marketValueAtSigning: { value: number; date: string } | null;
  exit: TransferExit;
  gain: number | null;
  roiPercent: number | null;
}

/** Club totals of GET /api/clubs/:id/transfers/roi; unknown amounts are left out */
export interface ClubRoiTotals {
  totalSpent: number;
  totalCurrentValue: number;
  totalResaleIncome: number;
  totalLoanIncome: number;
  netGain: number;
}

/** GET /api/clubs/:id/transfers/roi */
export interface ClubRoiResponse {
  transfers: ClubTransferRoi[];
  totals: ClubRoiTotals;
}
