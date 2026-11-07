import { Routes } from '@angular/router';

/**
 * Top-level routes: one lazy-loaded feature per dashboard. URL paths are in
 * English like the rest of the code; only the visible UI copy is French.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'players' },
  {
    path: 'players',
    title: 'Joueurs | Plus-Value',
    loadChildren: () => import('./features/players/routes').then((m) => m.routes)
  },
  {
    path: 'transfer-roi',
    title: 'Rentabilité des transferts | Plus-Value',
    loadChildren: () => import('./features/transfer-roi/routes').then((m) => m.routes)
  },
  {
    path: 'squad-value',
    title: "Valeur de l'effectif | Plus-Value",
    loadChildren: () => import('./features/squad-value/routes').then((m) => m.routes)
  },
  { path: '**', redirectTo: 'players' }
];
