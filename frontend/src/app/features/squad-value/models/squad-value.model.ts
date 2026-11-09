import { Position } from '../../../shared/positions';

/** One player of GET /api/clubs/:id/seasons/:seasonId/squad-value (dates are ISO strings) */
export interface SquadPlayer {
  id: string;
  name: string | null;
  position: Position;
  subPosition: string | null;
  /** Null when the player was not valued in the market window before the reference date */
  marketValue: { value: number; date: string } | null;
  /** Date of the move that started his current stay at the club; null when unknown */
  joinedAt?: string | null;
  /** True when he is at the club on loan */
  joinedOnLoan?: boolean;
  /** Fee of that move; 0 for a free signing or a player from the club's own reserve team, null when unknown */
  feePaid?: number | null;
  /** Market value minus the fee paid; null when either is unknown or he is on loan */
  gainSinceJoining?: number | null;
  /** End of his contract as the dataset last saw it; null when unknown */
  contractExpiresAt?: string | null;
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
