// shared/shared.module.ts — Re-usable declarations and imports
// TODO: add shared components, directives, and pipes here

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@NgModule({
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  exports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    // TODO: export shared components (CurrencyPipe, LoadingSpinnerComponent, etc.)
  ],
  declarations: [
    // TODO: declare shared components, directives, and pipes
  ],
})
export class SharedModule {}
