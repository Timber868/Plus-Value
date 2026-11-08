/**
 * Reserve and youth team detection (Lyon B, Olympique Marseille U19, ...).
 *
 * A move between a club and its own reserve or youth team is internal: when
 * the dataset has no fee for it, the fee is taken as 0. Two names belong to
 * the same club when one of them carries a reserve or youth marker (B, II,
 * U19, Reserve, ...) and, once markers and generic words (FC, AS, de, ...)
 * are removed, both keep the same words, a word matching when one is a
 * prefix of the other ("Lyon" and "Lyonnais").
 */

const RESERVE_MARKER = /^(b|ii|reserves?|espoirs|jeunes|youth|academy|u\d{2})$/;
const GENERIC = new Set(["fc", "sc", "ac", "as", "us", "rc", "cf", "afc", "club", "de", "du", "des", "la", "le", "les", "d"]);

/**
 * Lowercase words of a club name without accents or punctuation.
 *
 * @param {string} name
 */
function words(name) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

const sameWord = (a, b) => a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a));

/**
 * Whether one club is the reserve or youth team of the other.
 *
 * @param {string | null | undefined} nameA
 * @param {string | null | undefined} nameB
 */
function isReserveTeamPair(nameA, nameB) {
  if (!nameA || !nameB) return false;
  const a = words(nameA);
  const b = words(nameB);
  if (!a.some((w) => RESERVE_MARKER.test(w)) && !b.some((w) => RESERVE_MARKER.test(w))) return false;

  const core = (ws) => ws.filter((w) => !RESERVE_MARKER.test(w) && !GENERIC.has(w));
  const coreA = core(a);
  const coreB = core(b);
  return coreA.length > 0 && coreA.length === coreB.length && coreA.every((w, i) => sameWord(w, coreB[i]));
}

/**
 * The fee of a move, taking an unknown fee between a club and its reserve
 * or youth team as 0.
 *
 * @param {number | null | undefined} fee
 * @param {string | null | undefined} sellerName
 * @param {string | null | undefined} buyerName
 * @returns {{ fee: number | null, reserveTeamMove: boolean }}
 */
function resolveFee(fee, sellerName, buyerName) {
  const reserveTeamMove = isReserveTeamPair(sellerName, buyerName);
  return { fee: fee ?? (reserveTeamMove ? 0 : null), reserveTeamMove };
}

module.exports = { isReserveTeamPair, resolveFee };
