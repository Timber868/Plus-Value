// models/player.model.ts — TypeScript interface for a Ligue 1 player

export interface MarketValue {
  amount: number;
  currency: string; // e.g. 'EUR'
}

export interface PlayerStats {
  goals: number;
  assists: number;
  appearances: number;
}

export interface Player {
  _id: string;
  name: string;
  position: 'GK' | 'CB' | 'LB' | 'RB' | 'CDM' | 'CM' | 'CAM' | 'LW' | 'RW' | 'ST';
  club: string; // Club _id
  nationality: string;
  dateOfBirth: string; // ISO date string
  marketValue: MarketValue;
  contractUntil: string; // ISO date string
  stats: PlayerStats;
  createdAt: string;
  updatedAt: string;
}
