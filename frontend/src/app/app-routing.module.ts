// app-routing.module.ts — Root routing configuration
// TODO: add lazy-loaded feature routes

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
// import { AuthGuard } from './guards/auth.guard';

const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  // TODO: lazy-load feature modules:
  // { path: 'dashboard', loadChildren: () => import('./pages/dashboard/dashboard.module').then(m => m.DashboardModule) },
  // { path: 'players',   loadChildren: () => import('./pages/players/players.module').then(m => m.PlayersModule) },
  // { path: 'clubs',     loadChildren: () => import('./pages/clubs/clubs.module').then(m => m.ClubsModule) },
  // { path: 'transfers', loadChildren: () => import('./pages/transfers/transfers.module').then(m => m.TransfersModule), canActivate: [AuthGuard] },
  { path: '**', redirectTo: 'dashboard' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
