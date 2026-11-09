import { Injectable, signal } from '@angular/core';

/** localStorage key of the crest URLs this browser has already shown */
export const KNOWN_CRESTS_KEY = 'pv-known-crests';
/** Most crest URLs remembered (Ligue 1, 2 and 3 plus their usual trading partners) */
export const MAX_KNOWN_CRESTS = 400;

/**
 * Keeps club crests ready to show without a visible delay.
 *
 * - Every crest URL that loaded once is remembered in localStorage, so on the
 *   next visit all known crests start loading as soon as the app starts,
 *   before any page asks for them. Only unfamiliar crests load on demand.
 * - Preloaded images are kept in memory for the whole session, so switching
 *   tabs or opening a dropdown shows a crest that is already decoded.
 * - The image bytes themselves stay in the browser's HTTP cache.
 */
@Injectable({ providedIn: 'root' })
export class CrestCacheService {
  private readonly images = new Map<string, HTMLImageElement>();
  private readonly loaded = signal<ReadonlySet<string>>(new Set());
  private known: string[] = readKnown();

  constructor() {
    this.preload(this.known);
  }

  /** Whether the crest at this URL is loaded and decoded in this session */
  isLoaded(url: string | null | undefined): boolean {
    return !!url && this.loaded().has(url);
  }

  /** Starts loading crests that are not loaded or loading yet */
  preload(urls: Iterable<string | null | undefined>): void {
    for (const url of urls) {
      if (!url || this.images.has(url)) continue;
      const img = new Image();
      img.decoding = 'async';
      this.images.set(url, img);
      img.onload = () => {
        const decoded = typeof img.decode === 'function' ? img.decode() : Promise.resolve();
        decoded.catch(() => undefined).then(() => this.markLoaded(url));
      };
      img.onerror = () => this.markFailed(url);
      img.src = url;
    }
  }

  /** Records a crest that loaded (in this cache or in an <img> on the page) */
  markLoaded(url: string): void {
    if (!this.loaded().has(url)) this.loaded.update((set) => new Set(set).add(url));
    if (!this.known.includes(url)) {
      this.known = [url, ...this.known].slice(0, MAX_KNOWN_CRESTS);
      writeKnown(this.known);
    }
  }

  /** Forgets a crest that failed to load, so it is not preloaded again */
  markFailed(url: string): void {
    this.images.delete(url);
    if (this.known.includes(url)) {
      this.known = this.known.filter((u) => u !== url);
      writeKnown(this.known);
    }
  }
}

function readKnown(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KNOWN_CRESTS_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === 'string') : [];
  } catch {
    return [];
  }
}

function writeKnown(urls: string[]): void {
  try {
    localStorage.setItem(KNOWN_CRESTS_KEY, JSON.stringify(urls));
  } catch {
    // Storage full or blocked: crests still load, just without the head start
  }
}
