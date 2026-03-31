// pages/transfers/transfers.component.ts — Transfer history & ROI analysis page
// TODO: load transfers, filter by season/club/type, display ROI metrics

import { Component, OnInit } from '@angular/core';
import { Transfer } from '../../models/transfer.model';

@Component({
  selector: 'app-transfers',
  templateUrl: './transfers.component.html',
  styleUrls: ['./transfers.component.css'],
})
export class TransfersComponent implements OnInit {
  transfers: Transfer[] = [];
  // TODO: inject TransferService

  ngOnInit(): void {
    // TODO: this.transferService.getAll().subscribe(res => this.transfers = res.data);
  }
}
