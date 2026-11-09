import { Component, ElementRef, HostListener, computed, inject, input, output, signal } from '@angular/core';
import { ClubCrestComponent, clubColor, clubInitials } from '../club-crest/club-crest.component';

export { clubColor, clubInitials };

/** A club as the picker needs it */
export interface PickerClub {
  id: string;
  name: string;
  /** Crest image; null shows the club's initials instead */
  logoUrl?: string | null;
}

/**
 * Club dropdown showing each club's crest (or its initials when there is no
 * crest or the image fails to load). Works with the keyboard: arrows to move,
 * Enter to choose, Escape to close.
 */
@Component({
  selector: 'app-club-picker',
  template: `
    <span class="label" [id]="labelId">Club</span>
    <button
      type="button"
      class="trigger"
      aria-haspopup="listbox"
      [attr.aria-expanded]="open()"
      [attr.aria-labelledby]="labelId"
      [attr.aria-activedescendant]="open() ? labelId + '-' + activeIndex() : null"
      (click)="toggle()"
      (keydown)="onTriggerKey($event)"
    >
      @if (current(); as club) {
        <app-club-crest [name]="club.name" [logoUrl]="club.logoUrl" />
        <span class="name">{{ club.name }}</span>
      } @else {
        <span class="name placeholder">Choisissez un club</span>
      }
      <span class="chevron" aria-hidden="true"></span>
    </button>

    @if (open()) {
      <ul class="list" role="listbox" [attr.aria-labelledby]="labelId" tabindex="-1">
        @for (club of clubs(); track club.id; let i = $index) {
          <li
            role="option"
            tabindex="-1"
            [id]="labelId + '-' + i"
            [attr.aria-selected]="club.id === selected()"
            [class.selected]="club.id === selected()"
            [class.active]="i === activeIndex()"
            (click)="choose(club.id)"
            (keydown.enter)="choose(club.id)"
            (mouseenter)="activeIndex.set(i)"
          >
            <app-club-crest [name]="club.name" [logoUrl]="club.logoUrl" />
            <span class="name">{{ club.name }}</span>
          </li>
        }
      </ul>
    }

  `,
  imports: [ClubCrestComponent],
  styles: `
    :host {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      width: 20rem;
      max-width: 100%;
    }

    .label {
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--pv-ink-muted);
    }

    .trigger {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      width: 100%;
      padding: 0.35rem 0.7rem;
      font: inherit;
      color: inherit;
      text-align: left;
      background: var(--pv-surface);
      border: 1px solid #c9d0da;
      border-radius: 8px;
      cursor: pointer;
    }

    .trigger:focus-visible,
    .trigger[aria-expanded='true'] {
      border-color: var(--pv-pitch);
      outline: 2px solid rgb(15 138 75 / 25%);
    }

    .name {
      flex: 1;
      overflow: hidden;
      font-weight: 600;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .placeholder {
      font-weight: 400;
      color: var(--pv-ink-muted);
    }

    .chevron {
      width: 0.5rem;
      height: 0.5rem;
      border-right: 2px solid currentColor;
      border-bottom: 2px solid currentColor;
      transform: rotate(45deg) translateY(-2px);
    }

    .list {
      position: absolute;
      top: 100%;
      left: 0;
      z-index: 10;
      width: 100%;
      max-height: 22rem;
      margin: 0.3rem 0 0;
      padding: 0.3rem;
      overflow-y: auto;
      list-style: none;
      background: var(--pv-surface);
      border: 1px solid var(--pv-border);
      border-radius: 10px;
      box-shadow: 0 12px 28px rgb(7 23 51 / 18%);
    }

    li {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.4rem 0.5rem;
      border-radius: 6px;
      cursor: pointer;
    }

    li.active {
      background: #eef7f1;
    }

    li.selected .name {
      color: var(--pv-pitch-deep);
    }

    li.selected::after {
      content: '';
      width: 0.45rem;
      height: 0.8rem;
      margin-right: 0.3rem;
      border-right: 2px solid var(--pv-pitch);
      border-bottom: 2px solid var(--pv-pitch);
      transform: rotate(45deg);
    }
  `
})
export class ClubPickerComponent {
  readonly clubs = input.required<PickerClub[]>();
  /** Id of the selected club */
  readonly selected = input<string | null>(null);
  readonly selectedChange = output<string>();

  readonly open = signal(false);
  readonly activeIndex = signal(0);
  readonly current = computed(() => this.clubs().find((c) => c.id === this.selected()) ?? null);

  readonly labelId = `club-picker-${Math.random().toString(36).slice(2, 8)}`;

  private readonly host = inject(ElementRef<HTMLElement>);

  toggle(): void {
    if (this.open()) {
      this.open.set(false);
      return;
    }
    const index = this.clubs().findIndex((c) => c.id === this.selected());
    this.activeIndex.set(Math.max(index, 0));
    this.open.set(true);
  }

  choose(id: string): void {
    this.open.set(false);
    if (id !== this.selected()) this.selectedChange.emit(id);
  }

  onTriggerKey(event: KeyboardEvent): void {
    const count = this.clubs().length;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!this.open()) {
        this.toggle();
        return;
      }
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.activeIndex.update((i) => (i + step + count) % count);
    } else if (event.key === 'Enter' && this.open()) {
      event.preventDefault();
      const club = this.clubs()[this.activeIndex()];
      if (club) this.choose(club.id);
    } else if (event.key === 'Escape') {
      this.open.set(false);
    }
  }

  /** Closes the list when clicking anywhere else on the page */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }
}
