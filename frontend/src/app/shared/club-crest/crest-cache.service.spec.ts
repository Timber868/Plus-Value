import { TestBed } from '@angular/core/testing';

import { CrestCacheService, KNOWN_CRESTS_KEY, MAX_KNOWN_CRESTS } from './crest-cache.service';

describe('CrestCacheService', () => {
  let created: { src: string; onload: (() => void) | null; onerror: (() => void) | null }[];
  let originalImage: typeof Image;

  beforeEach(() => {
    localStorage.removeItem(KNOWN_CRESTS_KEY);
    created = [];
    originalImage = window.Image;
    // A fake Image that records what is loaded, so no request leaves the test
    (window as unknown as { Image: unknown }).Image = class {
      src = '';
      decoding = '';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() {
        created.push(this);
      }
    };
  });

  afterEach(() => {
    window.Image = originalImage;
    localStorage.removeItem(KNOWN_CRESTS_KEY);
  });

  const service = () => TestBed.inject(CrestCacheService);
  const flush = () => new Promise((resolve) => setTimeout(resolve));

  it('preloads every crest remembered from an earlier visit as soon as it is created', () => {
    localStorage.setItem(KNOWN_CRESTS_KEY, JSON.stringify(['/crests/1041.png', '/crests/583.png']));

    service();

    expect(created.map((img) => img.src)).toEqual(['/crests/1041.png', '/crests/583.png']);
  });

  it('loads each crest once, marks it loaded and remembers it for the next visit', async () => {
    const cache = service();
    cache.preload(['/crests/1041.png', '/crests/1041.png', null]);
    expect(created.length).toBe(1);
    expect(cache.isLoaded('/crests/1041.png')).toBeFalse();

    created[0].onload!();
    await flush();

    expect(cache.isLoaded('/crests/1041.png')).toBeTrue();
    expect(JSON.parse(localStorage.getItem(KNOWN_CRESTS_KEY)!)).toEqual(['/crests/1041.png']);
  });

  it('forgets a crest that fails to load', () => {
    localStorage.setItem(KNOWN_CRESTS_KEY, JSON.stringify(['/crests/broken.png']));
    const cache = service();

    created[0].onerror!();

    expect(cache.isLoaded('/crests/broken.png')).toBeFalse();
    expect(JSON.parse(localStorage.getItem(KNOWN_CRESTS_KEY)!)).toEqual([]);
  });

  it('keeps the most recent crests when the list is full', () => {
    const cache = service();
    for (let i = 0; i <= MAX_KNOWN_CRESTS; i++) cache.markLoaded(`/crests/${i}.png`);

    const known = JSON.parse(localStorage.getItem(KNOWN_CRESTS_KEY)!) as string[];
    expect(known.length).toBe(MAX_KNOWN_CRESTS);
    expect(known[0]).toBe(`/crests/${MAX_KNOWN_CRESTS}.png`);
  });
});
