// models/club.model.ts — TypeScript interface for a Ligue 1 club

export interface Club {
  _id: string;
  name: string;
  shortName: string;
  city: string;
  stadium: string;
  foundedYear: number;
  transferBudget: { amount: number; currency: string };
  squad: string[]; // Player _id array
  logoUrl: string;
  createdAt: string;
  updatedAt: string;
}
