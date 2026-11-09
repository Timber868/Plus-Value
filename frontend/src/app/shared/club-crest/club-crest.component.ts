import { Component, computed, input, signal } from '@angular/core';

/** Initials of a club name for its fallback badge, skipping generic words (FC, AS, de...) */
export function clubInitials(name: string): string {
  const generic = new Set(['fc', 'sc', 'ac', 'as', 'us', 'rc', 'cf', 'de', 'du', 'la', 'le', 'les', 'd']);
  const words = name.split(/[\s-]+/).filter((w) => w && !generic.has(w.toLowerCase()));
  const picked = (words.length > 0 ? words : name.split(/\s+/)).slice(0, 2);
  return picked.map((w) => w.charAt(0).toUpperCase()).join('');
}

/** A stable colour per club name for its fallback badge */
export function clubColor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return `hsl(${Math.abs(hash) % 360} 55% 38%)`;
}

/**
 * A club's crest, or a round badge with its initials when there is no crest
 * or the image fails to load. Decorative: the club name is always written
 * next to it, so screen readers skip it.
 */
@Component({
  selector: 'app-club-crest',
  template: `
    @if (showImage()) {
      <img
        class="crest"
        [src]="logoUrl()"
        alt=""
        [width]="size()"
        [height]="size()"
        loading="lazy"
        decoding="async"
        (error)="failed.set(true)"
      />
    } @else {
      <span
        class="crest badge"
        [style.background]="color()"
        [style.width.px]="size()"
        [style.height.px]="size()"
        [style.font-size.px]="size() * 0.42"
        aria-hidden="true"
        >{{ initials() }}</span
      >
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
      vertical-align: middle;
    }

    .crest {
      object-fit: contain;
    }

    .badge {
      display: inline-grid;
      place-items: center;
      font-family: var(--pv-display);
      font-weight: 700;
      line-height: 1;
      color: #fff;
      border-radius: 50%;
    }
  `
})
export class ClubCrestComponent {
  readonly name = input.required<string>();
  readonly logoUrl = input<string | null | undefined>(null);
  /** Width and height in pixels */
  readonly size = input(28);

  /** True once the image failed to load; the badge shows instead */
  readonly failed = signal(false);
  readonly showImage = computed(() => !!this.logoUrl() && !this.failed());
  readonly initials = computed(() => clubInitials(this.name()));
  readonly color = computed(() => clubColor(this.name()));
}
