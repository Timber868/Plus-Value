import { Component, input, model } from '@angular/core';

/**
 * Switch between nominal amounts ("euros courants") and amounts in constant
 * euros of a reference year, with one sentence explaining the current choice.
 * Use with [(constant)].
 */
@Component({
  selector: 'app-money-toggle',
  template: `
    <div class="toggle" role="group" aria-label="Unité des montants">
      <button type="button" [attr.aria-pressed]="!constant()" (click)="constant.set(false)">Euros courants</button>
      <button type="button" [attr.aria-pressed]="constant()" (click)="constant.set(true)">
        Euros constants de {{ referenceYear() }}
      </button>
    </div>
    <p class="explanation">
      @if (constant()) {
        Les montants sont convertis en euros de {{ referenceYear() }} selon l'inflation de la zone euro, pour comparer
        des sommes payées à des années différentes.
      } @else {
        Les montants sont affichés tels qu'ils ont été payés, sans tenir compte de l'inflation.
      }
    </p>
  `,
  styles: `
    :host {
      display: block;
      margin: 1rem 0;
    }

    .toggle {
      display: inline-flex;
      border: 1px solid #c9d0da;
      border-radius: 6px;
      overflow: hidden;
    }

    button {
      padding: 0.4rem 0.8rem;
      font: inherit;
      color: #3d4652;
      background: #fff;
      border: none;
      cursor: pointer;
    }

    button + button {
      border-left: 1px solid #c9d0da;
    }

    button[aria-pressed='true'] {
      color: #fff;
      background: #1f5fbf;
    }

    .explanation {
      margin: 0.4rem 0 0;
      font-size: 0.9rem;
      color: #5b6675;
    }
  `
})
export class MoneyToggleComponent {
  readonly referenceYear = input.required<number>();
  /** True shows constant euros of the reference year */
  readonly constant = model(false);
}
