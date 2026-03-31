// interceptors/http.interceptor.ts — Attaches JWT token to outgoing requests
// TODO: read token from AuthService/localStorage and set Authorization header

import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
} from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // TODO: const token = localStorage.getItem('token');
    // TODO: if (token) {
    // TODO:   req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
    // TODO: }
    return next.handle(req); // placeholder — passes request unchanged
  }
}
