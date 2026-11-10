import { Router } from '@angular/router';

import { DEFAULT_LEAGUE, FRENCH_LEAGUES } from './league-tabs/league-tabs.component';

/**
 * Writes a page's picks into the query string of the current URL without
 * adding a history entry, so the back button brings the reader back to the
 * page as they left it, and the link can be shared. Null values are left out.
 */
export function replaceQueryParams(router: Router, params: Record<string, string | null>): void {
  const tree = router.parseUrl(router.url);
  const before = router.serializeUrl(tree);
  tree.queryParams = Object.fromEntries(Object.entries(params).filter(([, value]) => value !== null));
  if (router.serializeUrl(tree) === before) return;
  void router.navigateByUrl(tree, { replaceUrl: true });
}

/** The league named in the URL when it is one of the tabs, otherwise the default league */
export function leagueFromUrl(value: string | null): string {
  return FRENCH_LEAGUES.some((league) => league.id === value) ? (value as string) : DEFAULT_LEAGUE;
}
