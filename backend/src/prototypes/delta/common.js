/**
 * Shared pieces of the "delta" prototypes: collectors that look for transfers
 * (and, where a source has them, fees) that happened after the last
 * transfermarkt-datasets refresh. Prototypes only: they print what they find
 * and never write to the database.
 *
 * Every collector returns records of the same shape:
 * {
 *   source: "wikipedia" | "api-football" | "amf",
 *   sourceUrl: string,           // where the row came from, for checking
 *   playerName: string,
 *   sourcePlayerId: string|null, // the source's own id, when it has one
 *   date: string|null,           // YYYY-MM-DD, null when the source has no date
 *   fromClub: string|null,
 *   toClub: string|null,
 *   isLoan: boolean,
 *   fee: number|null,            // euros; null when unknown, 0 for a free move
 *   feeText: string|null,        // the fee as the source wrote it
 *   addOns: number|null,         // euros of add-ons, when the source gives them
 *   sellOnPercent: number|null
 * }
 */

/** User-Agent sent to every source, as Wikipedia and others ask for */
const USER_AGENT = "PlusValueDeltaPrototype/0.1 (https://github.com/Timber868/Plus-Value)";

/**
 * Turns an amount like "€ 12M", "€750K", "12,5 millions", "€1.5m" or "33.6 million" into euros.
 * Returns null when no amount is found.
 *
 * @param {string|null|undefined} text
 * @returns {number|null}
 */
function parseAmount(text) {
  if (!text) return null;
  const m = String(text).match(/(\d+(?:[.,]\d+)?)\s*(m|mn|mio|million|millions|k|thousand)?\b/i);
  if (!m) return null;
  const value = parseFloat(m[1].replace(",", "."));
  const unit = (m[2] || "").toLowerCase();
  if (unit.startsWith("m")) return Math.round(value * 1e6);
  if (unit === "k" || unit === "thousand") return Math.round(value * 1e3);
  return Math.round(value);
}

/**
 * Reads a free-text transfer type as written by API-Football ("€ 12M", "Loan",
 * "Free", "N/A", "Back from Loan", "Free Transfer").
 *
 * @param {string|null|undefined} type
 * @returns {{ fee: number|null, isLoan: boolean, isLoanReturn: boolean }}
 */
function parseTransferType(type) {
  const text = (type || "").trim();
  if (/back from loan|end of loan|loan return/i.test(text)) return { fee: 0, isLoan: false, isLoanReturn: true };
  if (/loan/i.test(text)) return { fee: parseAmount(text), isLoan: true, isLoanReturn: false };
  if (/free/i.test(text)) return { fee: 0, isLoan: false, isLoanReturn: false };
  if (!text || /^n\/?a$|^-$|^\?$/i.test(text)) return { fee: null, isLoan: false, isLoanReturn: false };
  return { fee: parseAmount(text), isLoan: false, isLoanReturn: false };
}

/** Keeps records dated on or after `since` (YYYY-MM-DD); undated records are kept, as the source cannot tell */
function keepSince(records, since) {
  if (!since) return records;
  return records.filter((r) => r.date === null || r.date >= since);
}

/** A record with every field present, so all sources print the same shape */
function record(fields) {
  return {
    source: fields.source,
    sourceUrl: fields.sourceUrl,
    playerName: fields.playerName,
    sourcePlayerId: fields.sourcePlayerId ?? null,
    date: fields.date ?? null,
    fromClub: fields.fromClub ?? null,
    toClub: fields.toClub ?? null,
    isLoan: fields.isLoan ?? false,
    fee: fields.fee ?? null,
    feeText: fields.feeText ?? null,
    addOns: fields.addOns ?? null,
    sellOnPercent: fields.sellOnPercent ?? null,
  };
}

/** GET returning JSON or text, with the prototype User-Agent and a clear error */
async function get(url, { fetchImpl = fetch, headers = {}, as = "json" } = {}) {
  const res = await fetchImpl(url, { headers: { "User-Agent": USER_AGENT, ...headers } });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
  return as === "json" ? res.json() : as === "buffer" ? Buffer.from(await res.arrayBuffer()) : res.text();
}

module.exports = { USER_AGENT, parseAmount, parseTransferType, keepSince, record, get };
