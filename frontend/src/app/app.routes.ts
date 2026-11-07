import { Routes } from '@angular/router';

/**
 * Top-level routes: one lazy-loaded feature per dashboard. URLs are in French
 * because the app is public and French-speaking.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'joueurs' },
  {
    path: 'joueurs',
    title: 'Joueurs | Plus-Value',
    loadChildren: () => import('./features/players/routes').then((m) => m.routes)
  },
  {
    path: 'transferts',
    title: 'Rentabilité des transferts | Plus-Value',
    loadChildren: () => import('./features/transfer-roi/routes').then((m) => m.routes)
  },
  {
    path: 'effectif',
    title: "Valeur de l'effectif | Plus-Value",
    loadChildren: () => import('./features/squad-value/routes').then((m) => m.routes)
  },
  { path: '**', redirectTo: 'joueurs' }
];
