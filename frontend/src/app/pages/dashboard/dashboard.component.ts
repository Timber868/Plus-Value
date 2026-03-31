// pages/dashboard/dashboard.component.ts — Overview / home page
// TODO: display KPI cards (total transfers, top market value, most active clubs, etc.)

import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit {
  // TODO: inject PlayerService, ClubService, TransferService
  // TODO: load summary statistics on init

  ngOnInit(): void {
    // TODO: fetch dashboard data
  }
}
