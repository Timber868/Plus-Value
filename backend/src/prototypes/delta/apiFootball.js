/**
 * Prototype 2: API-Football (api-sports.io) transfers.
 *
 * Official API, free plan of 100 requests a day (key in API_FOOTBALL_KEY),
 * paid plans from about 20 USD a month. Each transfer has a date, both clubs
 * and a free-text type ("€ 12M", "Loan", "Free", "N/A"). No market values.
 * There is no league or date filter on /transfers, so the prototype lists the
 * league's teams once, then asks each team's transfers and keeps those after
 * the given date: about 19 requests for Ligue 1, 19 for Ligue 2.
 * League ids: Ligue 1 = 61, Ligue 2 = 62, National = 63.
 */
const { get, keepSince, parseTransferType, record } = require("./common");

const BASE = "https://v3.football.api-sports.io";

function teamsUrl(leagueId, season) {
  return `${BASE}/teams?league=${leagueId}&season=${season}`;
}

function transfersUrl(teamId) {
  return `${BASE}/transfers?team=${teamId}`;
}

/** Team ids and names from a /teams response */
function parseTeams(body) {
  return (body.response || []).map((r) => ({ id: r.team.id, name: r.team.name }));
}

/**
 * Transfers from a /transfers response, one record per move. The same move
 * appears in both clubs' answers, so callers dedupe (see dedupe).
 *
 * @param {object} body
 * @param {string} sourceUrl
 */
function parseTransfers(body, sourceUrl) {
  const records = [];
  for (const entry of body.response || []) {
    for (const t of entry.transfers || []) {
      const { fee, isLoan, isLoanReturn } = parseTransferType(t.type);
      if (isLoanReturn) continue;
      records.push(
        record({
          source: "api-football",
          sourceUrl,
          playerName: entry.player.name,
          sourcePlayerId: String(entry.player.id),
          date: t.date ? t.date.slice(0, 10) : null,
          fromClub: t.teams && t.teams.out ? t.teams.out.name : null,
          toClub: t.teams && t.teams.in ? t.teams.in.name : null,
          isLoan,
          fee,
          feeText: t.type ?? null,
        }),
      );
    }
  }
  return records;
}

/** One record per player, date and clubs */
function dedupe(records) {
  const seen = new Map();
  for (const r of records) seen.set(`${r.sourcePlayerId}|${r.date}|${r.fromClub}|${r.toClub}`, r);
  return [...seen.values()];
}

/**
 * @param {{ apiKey: string, leagueIds: number[], season: number, since: string, fetchImpl?: typeof fetch, maxRequests?: number }} options
 */
async function collect({ apiKey, leagueIds, season, since, fetchImpl, maxRequests = 90 }) {
  if (!apiKey) throw new Error("API-Football needs API_FOOTBALL_KEY (free key at dashboard.api-football.com)");
  const headers = { "x-apisports-key": apiKey };
  let requests = 0;
  const call = (url) => {
    if (++requests > maxRequests) throw new Error(`Stopped after ${maxRequests} requests to stay inside the daily quota`);
    return get(url, { fetchImpl, headers });
  };

  const all = [];
  for (const leagueId of leagueIds) {
    const teams = parseTeams(await call(teamsUrl(leagueId, season)));
    for (const team of teams) {
      const url = transfersUrl(team.id);
      all.push(...parseTransfers(await call(url), url));
    }
  }
  return keepSince(dedupe(all), since);
}

module.exports = { teamsUrl, transfersUrl, parseTeams, parseTransfers, dedupe, collect };
