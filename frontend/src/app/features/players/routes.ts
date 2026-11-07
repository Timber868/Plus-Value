import { Routes } from '@angular/router';

import { PlayerDetailPageComponent } from './player-detail-page.component';
import { PlayersPageComponent } from './players-page.component';

/** Routes of the KF-1 feature, lazy-loaded from app.routes.ts */
export const routes: Routes = [
  { path: '', component: PlayersPageComponent },
  { path: ':id', component: PlayerDetailPageComponent }
];
