// navbar.component.ts — Top navigation bar
// TODO: show active route, user auth state, and responsive menu

import { Component } from '@angular/core';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
})
export class NavbarComponent {
  // TODO: inject Router and AuthService
  navLinks = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Players',   path: '/players' },
    { label: 'Clubs',     path: '/clubs' },
    { label: 'Transfers', path: '/transfers' },
  ];
}
