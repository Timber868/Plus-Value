// app.module.ts — Root Angular module
// TODO: declare all components, import feature modules

import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

// TODO: import and declare feature components (NavbarComponent, FooterComponent, etc.)
// TODO: import HTTP_INTERCEPTORS provider for HttpInterceptor

@NgModule({
  declarations: [
    AppComponent,
    // TODO: NavbarComponent,
    // TODO: FooterComponent,
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    AppRoutingModule,
  ],
  providers: [
    // TODO: { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
