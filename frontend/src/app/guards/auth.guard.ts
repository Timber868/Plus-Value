// guards/auth.guard.ts — Protects routes that require authentication
// TODO: check auth state from an AuthService

import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private router: Router) {}

  canActivate(): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    // TODO: inject AuthService and check isAuthenticated$
    //   const isAuth = this.authService.isAuthenticated();
    //   return isAuth ? true : this.router.parseUrl('/login');
    return true; // placeholder — always allows access
  }
}
