/** A club reference inside API responses */
export interface ClubRef {
  id: string;
  name: string;
}

/** One item of GET /api/leagues */
export interface LeagueOption {
  /** Transfermarkt competition id such as "FR1", used by the league filters */
  id: string;
  name: string;
  country: string | null;
  tier: number | null;
}

/** One item of GET /api/clubs */
export interface ClubOption {
  id: string;
  name: string;
  country: string;
  /** Crest image URL; null when none is configured */
  logoUrl?: string | null;
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
  /** True when the seller is the club's own reserve or youth team; an unknown fee then counts as 0 */
  reserveTeamMove: boolean;
  /** Null when the fee is unknown (free or undisclosed) */
  feePaid: number | null;
  marketValueAtSigning: { value: number; date: string } | null;
  exit: TransferExit;
  gain: number | null;
  roiPercent: number | null;
  /** Fee of the permanent move that ended his stay, without loan fees; null when not sold or unknown */
  soldFor: number | null;
  /** Latest valuation if revalued in the last market window, otherwise null */
  currentMarketValue: number | null;
  /** currentMarketValue minus feePaid; null when either is unknown or for a loan */
  valueGain: number | null;
  /** soldFor minus feePaid; null when not sold or an amount is unknown */
  resaleGain: number | null;
  /** The same figures in constant euros of the reference year (see InflationInfo) */
  adjusted: {
    feePaid: number | null;
    exitValue: number | null;
    gain: number | null;
    roiPercent: number | null;
    valueGain: number | null;
    resaleGain: number | null;
  };
}

/** Index and reference year of the constant-euro figures */
export interface InflationInfo {
  /** "hicp": euro area consumer inflation */
  index: string;
  referenceYear: number;
}

/** One permanent departure of GET /api/clubs/:id/transfers/roi */
export interface ClubSale {
  player: { id: string; name: string | null };
  date: string;
  toClub: ClubRef | null;
  /** Null when the fee is unknown */
  soldFor: number | null;
  /** What the player cost the club; 0 when it formed him, null when unknown */
  sellerCost: number | null;
  /** True when the club formed the player (no earlier signing by it) */
  homegrown: boolean;
  /** Money the club made: soldFor plus loan fees minus sellerCost; null when an amount is unknown */
  gain: number | null;
  /** The same gain in constant euros of the reference year */
  adjustedGain: number | null;
  /** Used for the order of the list */
  currentMarketValue: number | null;
}

/** Club totals of GET /api/clubs/:id/transfers/roi; unknown amounts are left out */
export interface ClubRoiTotals {
  totalSpent: number;
  totalCurrentValue: number;
  totalResaleIncome: number;
  totalLoanIncome: number;
  netGain: number;
  /** Spending and net gain in constant euros of the reference year */
  adjusted: { totalSpent: number; netGain: number };
}

/** GET /api/clubs/:id/transfers/roi */
export interface ClubRoiResponse {
  transfers: ClubTransferRoi[];
  totals: ClubRoiTotals;
  sales: ClubSale[];
  inflation: InflationInfo;
}
