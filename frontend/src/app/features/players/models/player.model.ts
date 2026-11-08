/** One market value snapshot as returned by the API (dates are ISO strings in JSON) */
export interface MarketValuePoint {
  value: number;
  date: string;
}

/** A club reference inside player responses */
export interface ClubRef {
  id: string;
  name: string;
}

/** One item of GET /api/players */
export interface PlayerSearchResult {
  id: string;
  name: string;
  nationality: string;
  currentClub: ClubRef | null;
  latestMarketValue: MarketValuePoint | null;
}

/** GET /api/players/:id */
export interface PlayerProfile {
  id: string;
  name: string;
  birthDate: string;
  nationality: string;
  currentClub: ClubRef | null;
  /** Null when the player was not revalued in the last market window (e.g. retired) */
  latestMarketValue: MarketValuePoint | null;
  peakMarketValue: MarketValuePoint | null;
}

/** One item of GET /api/players/:id/transfers */
export interface PlayerTransfer {
  date: string;
  /** Null when the dataset has no selling club (e.g. a youth signing) */
  fromClub: ClubRef | null;
  toClub: ClubRef;
  /** Null when the fee is unknown (free or undisclosed in the dataset) */
  fee: number | null;
}
