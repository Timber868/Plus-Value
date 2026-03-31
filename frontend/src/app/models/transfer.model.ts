// models/transfer.model.ts — TypeScript interface for a player transfer

export type TransferType = 'permanent' | 'loan' | 'free' | 'youth';

export interface Transfer {
  _id: string;
  player: string;   // Player _id
  fromClub: string; // Club _id
  toClub: string;   // Club _id
  fee: { amount: number; currency: string };
  transferDate: string; // ISO date string
  type: TransferType;
  season: string;   // e.g. '2024-25'
  roi: number | null;
  createdAt: string;
  updatedAt: string;
}
