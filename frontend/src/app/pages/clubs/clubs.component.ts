// pages/clubs/clubs.component.ts — Club list & budget overview page
// TODO: load clubs and display squad/budget info

import { Component, OnInit } from '@angular/core';
import { Club } from '../../models/club.model';

@Component({
  selector: 'app-clubs',
  templateUrl: './clubs.component.html',
  styleUrls: ['./clubs.component.css'],
})
export class ClubsComponent implements OnInit {
  clubs: Club[] = [];
  // TODO: inject ClubService

  ngOnInit(): void {
    // TODO: this.clubService.getAll().subscribe(res => this.clubs = res.data);
  }
}
