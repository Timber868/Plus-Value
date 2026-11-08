const Club = require("../models/Club");
const ClubSeason = require("../models/ClubSeason");
const League = require("../models/League");
const Season = require("../models/Season");

/**
 * Mongo id of the league with this Transfermarkt competition id (e.g. "FR1"),
 * or null when it is unknown.
 *
 * @param {string} competitionId
 */
async function findLeagueId(competitionId) {
  const league = await League.findOne({ competitionId }, { _id: 1 }).lean();
  return league ? league._id : null;
}

/**
 * Clubs for the club picker, sorted by name. Without a league, returns the
 * clubs of the synced league (every club not flagged external). With a
 * league, returns the clubs that played at least one season in it.
 *
 * @param {{ league?: string | null }} [options] Transfermarkt competition id
 * @returns {Promise<Array<{ id: string, name: string, country: string }>>}
 */
async function listClubs({ league = null } = {}) {
  let filter = { isExternal: { $ne: true } };

  if (league) {
    const leagueId = await findLeagueId(league);
    if (!leagueId) return [];
    const seasonIds = await Season.distinct("_id", { league: leagueId });
    const clubIds = await ClubSeason.distinct("club", { season: { $in: seasonIds } });
    filter = { _id: { $in: clubIds } };
  }

  const clubs = await Club.find(filter, { name: 1, country: 1 }).sort({ name: 1 }).lean();
  return clubs.map((c) => ({ id: String(c._id), name: c.name, country: c.country }));
}

/**
 * Seasons for the season picker, newest first, optionally limited to one
 * league.
 *
 * @param {{ league?: string | null }} [options] Transfermarkt competition id
 * @returns {Promise<Array<{ id: string, period: string, startDate: Date, endDate: Date, league: string | null }>>}
 */
async function listSeasons({ league = null } = {}) {
  const filter = {};
  if (league) {
    const leagueId = await findLeagueId(league);
    if (!leagueId) return [];
    filter.league = leagueId;
  }

  const seasons = await Season.find(filter, { period: 1, startDate: 1, endDate: 1, league: 1 })
    .sort({ startDate: -1 })
    .populate("league", "competitionId")
    .lean();

  return seasons.map((s) => ({
    id: String(s._id),
    period: s.period,
    startDate: s.startDate,
    endDate: s.endDate,
    league: s.league ? s.league.competitionId : null,
  }));
}

/**
 * Leagues for the league picker: the league competitions that have at least
 * one synced season, by tier (Ligue 1 before Ligue 2) then name.
 *
 * @returns {Promise<Array<{ id: string, name: string, country: string | null, tier: number | null }>>}
 *   id is the Transfermarkt competition id used by the league filters
 */
async function listLeagues() {
  const leagueIds = await Season.distinct("league");
  const leagues = await League.find(
    { _id: { $in: leagueIds }, competitionFormat: "league" },
    { competitionId: 1, name: 1, country: 1, tier: 1 },
  ).lean();

  return leagues
    .map((l) => ({ id: l.competitionId, name: l.name, country: l.country ?? null, tier: l.tier ?? null }))
    .sort((a, b) => (a.tier ?? 99) - (b.tier ?? 99) || a.name.localeCompare(b.name, "fr"));
}

module.exports = { listClubs, listSeasons, listLeagues };
