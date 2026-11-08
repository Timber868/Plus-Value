/** Dataset position of a player; null when unknown */
export type Position = 'Goalkeeper' | 'Defender' | 'Midfield' | 'Attack' | null;

/** One player of GET /api/clubs/:id/seasons/:seasonId/squad-value (dates are ISO strings) */
export interface SquadPlayer {
  id: string;
  name: string | null;
  position: Position;
  subPosition: string | null;
  /** Null when the player was not valued in the market window before the reference date */
  marketValue: { value: number; date: string } | null;
}

/** Total value of the players of one position */
export interface PositionTotal {
  position: Position;
  playerCount: number;
  totalValue: number;
}

/** GET /api/clubs/:id/seasons/:seasonId/squad-value */
export interface SquadValueResponse {
  club: { id: string; name: string };
  season: { id: string; period: string };
  /** Date the values are taken at: the season's end, or the newest valuation while it runs */
  referenceDate: string;
  /** Highest value first */
  players: SquadPlayer[];
  totals: {
    totalValue: number;
    playerCount: number;
    valuedPlayerCount: number;
    byPosition: PositionTotal[];
  };
}

/** One season of GET /api/clubs/:id/squad-value/history */
export interface SquadValueHistoryPoint {
  season: { id: string; period: string };
  referenceDate: string;
  totalValue: number;
  playerCount: number;
  valuedPlayerCount: number;
}

/** GET /api/clubs/:id/squad-value/history, oldest season first */
export interface SquadValueHistory {
  club: { id: string; name: string };
  seasons: SquadValueHistoryPoint[];
}
