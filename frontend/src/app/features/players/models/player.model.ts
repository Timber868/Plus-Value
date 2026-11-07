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
