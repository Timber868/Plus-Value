// pages/players/players.component.ts — Player list & management page
// TODO: load players, support search/filter/pagination

import { Component, OnInit } from '@angular/core';
import { Player } from '../../models/player.model';

@Component({
  selector: 'app-players',
  templateUrl: './players.component.html',
  styleUrls: ['./players.component.css'],
})
export class PlayersComponent implements OnInit {
  players: Player[] = [];
  // TODO: inject PlayerService

  ngOnInit(): void {
    // TODO: this.playerService.getAll().subscribe(res => this.players = res.data);
  }
}
