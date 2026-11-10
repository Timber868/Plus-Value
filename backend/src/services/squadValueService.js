const Club = require("../models/Club");
const Season = require("../models/Season");
const ClubSeason = require("../models/ClubSeason");
const Player = require("../models/Player");
const Transfer = require("../models/Transfer");
const MarketValue = require("../models/MarketValue");
const { computeCutoff, currentOrNull } = require("./marketValueCutoff");
const { valueOnOrBefore, loanStatus, loanInFeeOf } = require("./transferRoi");
const { resolveFee } = require("./reserveTeam");

/**
 * Squad value of a club in a season (KF-3).
 *
 * Squad membership: a player belongs to the club's squad in a season when
 * his latest transfer on or before the season's end date has the club as
 * buyer (same-day moves are ordered paid first, so a sale with a loan back
 * keeps the player at the club). A player on loan at the season's end counts for the club he is
 * loaned to. Players with no transfer at all in the data (some academy
 * players) cannot be placed and are left out.
 *
 * Value: each player's latest valuation on or before the reference date,
 * which is the season's end date, or the newest valuation in the data when
 * the season is not over yet. Like the current value rule (ECS-163), a
 * valuation older than one market window before the reference date counts as
 * unknown (null) and is left out of the totals.
 *
 * Arrival (Tim, Nov 9): for each player, the move that started his current
 * stay, which is his latest move to the club before the season's end that is
 * not a return from a loan the club had given him. joinedAt is its date,
 * feePaid its fee (null when unknown; an unknown fee from the club's own
 * reserve team counts as 0; a purchase that converts a loan adds that loan's
 * fee, as on the club ROI page), joinedOnLoan whether he came on loan, and
 * gainSinceJoining the market value minus the fee paid (null when either is
 * unknown or he is on loan). contractExpiresAt comes from the dataset.
 */

/** Order of the positions in the totals; null (unknown position) goes last */
const POSITIONS = ["Goalkeeper", "Defender", "Midfield", "Attack", null];

const time = (date) => new Date(date).getTime();
const paid = (t) => (t.fee > 0 ? 1 : 0);
/** Whether move a comes after move b; same-day moves are ordered paid first, like transferRoi's aroundTransfer */
const isAfter = (a, b) => time(a.date) > time(b.date) || (time(a.date) === time(b.date) && paid(a) < paid(b));

/**
 * Builds the squad from already loaded documents. Pure, so it can be tested
 * without a database.
 *
 * @param {object} args
 * @param {*} args.clubId
 * @param {Date} args.squadDate season end date: transfers up to it decide membership
 * @param {Date} args.referenceDate valuations up to it count
 * @param {Array<{ player: *, date: Date, buyer: *, seller?: *, fee?: number | null }>} args.transfers transfers of the candidate players up to squadDate
 * @param {Array<{ player: *, date: Date, value: number }>} args.valuations valuations of the candidate players
 * @param {Array<{ _id: *, position?: string | null, subPosition?: string | null, person?: { name: string } }>} args.players
 */
function computeSquad({ clubId, squadDate, referenceDate, transfers, valuations, players }) {
  const latestMove = new Map();
  for (const t of transfers) {
    if (time(t.date) > time(squadDate)) continue;
    const key = String(t.player);
    const current = latestMove.get(key);
    if (!current || isAfter(t, current)) latestMove.set(key, t);
  }

  // Every move, also after the season's end: a loan is only recognised by the player's return
  const movesByPlayer = new Map();
  for (const t of transfers) {
    const key = String(t.player);
    if (!movesByPlayer.has(key)) movesByPlayer.set(key, []);
    movesByPlayer.get(key).push(t);
  }

  /** The move that started the player's current stay at the club (see Arrival above) */
  const arrivalOf = (playerId) => {
    const moves = movesByPlayer.get(playerId) || [];
    const toClub = moves
      .filter((m) => String(m.buyer) === String(clubId) && time(m.date) <= time(squadDate))
      .sort((a, b) => time(b.date) - time(a.date) || paid(a) - paid(b));
    for (const move of toClub) {
      const status = loanStatus(move, moves);
      if (!status.isLoanReturn) return { move, onLoan: status.isLoan };
    }
    return null;
  };

  const valuationsByPlayer = new Map();
  for (const v of valuations) {
    const key = String(v.player);
    if (!valuationsByPlayer.has(key)) valuationsByPlayer.set(key, []);
    valuationsByPlayer.get(key).push(v);
  }

  const cutoff = computeCutoff(referenceDate);
  const squad = players
    .filter((p) => {
      const move = latestMove.get(String(p._id));
      return move && String(move.buyer) === String(clubId);
    })
    .map((p) => {
      const valuation = currentOrNull(valueOnOrBefore(valuationsByPlayer.get(String(p._id)) || [], referenceDate), cutoff);
      const arrival = arrivalOf(String(p._id));
      const fee = arrival ? arrival.move.fee ?? null : null;
      // A purchase that converts a loan also cost the loan fee, as on the club ROI page
      const feePaid = fee === null ? null : fee + loanInFeeOf(arrival.move, movesByPlayer.get(String(p._id)) || []);
      const onLoan = arrival ? arrival.onLoan : false;
      return {
        id: String(p._id),
        name: p.person ? p.person.name : null,
        position: p.position ?? null,
        subPosition: p.subPosition ?? null,
        marketValue: valuation ? { value: valuation.value, date: valuation.date } : null,
        joinedAt: arrival ? arrival.move.date : null,
        joinedOnLoan: onLoan,
        feePaid,
        gainSinceJoining: valuation && feePaid !== null && !onLoan ? valuation.value - feePaid : null,
        contractExpiresAt: p.contractExpiresAt ?? null,
      };
    })
    .sort((a, b) => (b.marketValue?.value ?? -1) - (a.marketValue?.value ?? -1) || String(a.name).localeCompare(String(b.name), "fr"));

  const total = (rows) => rows.reduce((sum, r) => sum + (r.marketValue ? r.marketValue.value : 0), 0);
  const byPosition = POSITIONS.map((position) => {
    const rows = squad.filter((p) => (POSITIONS.includes(p.position) ? p.position : null) === position);
    return { position, playerCount: rows.length, totalValue: total(rows) };
  }).filter((group) => group.playerCount > 0);

  return {
    players: squad,
    totals: {
      totalValue: total(squad),
      playerCount: squad.length,
      valuedPlayerCount: squad.filter((p) => p.marketValue).length,
      byPosition,
    },
  };
}

/**
 * Reference date for a season: its end date, or the newest valuation in the
 * data when the season is not over yet.
 *
 * @param {{ endDate: Date }} season
 * @param {{ date: Date } | null} newest newest valuation in the data
 */
function referenceDateOf(season, newest) {
  return newest && time(newest.date) < time(season.endDate) ? newest.date : season.endDate;
}

/**
 * Loads the transfers, valuations and players of everyone who joined the
 * club up to a date, ready for computeSquad.
 *
 * @param {*} clubId
 * @param {Date} upTo
 */
async function loadSquadData(clubId, upTo) {
  const candidateIds = await Transfer.distinct("player", { buyer: clubId, date: { $lte: upTo } });
  const [transfers, valuations, players] = await Promise.all([
    // All their moves, also later ones, so a loan can be told apart by the player's return
    Transfer.find({ player: { $in: candidateIds } }, { player: 1, date: 1, buyer: 1, seller: 1, price: 1 })
      .populate("buyer", "name")
      .populate("seller", "name")
      .lean(),
    MarketValue.find({ player: { $in: candidateIds }, date: { $lte: upTo } }, { player: 1, date: 1, value: 1 }).lean(),
    Player.find({ _id: { $in: candidateIds } }, { position: 1, subPosition: 1, person: 1, contractExpiresAt: 1 }).populate("person", "name").lean(),
  ]);
  // Clubs back to ids for membership and loan checks, with the fee resolved by name (reserve team rule)
  const idOf = (c) => (c && c._id !== undefined ? c._id : c ?? null);
  const nameOf = (c) => (c && c.name) || null;
  const moves = transfers.map((t) => ({
    player: t.player,
    date: t.date,
    buyer: idOf(t.buyer),
    seller: idOf(t.seller),
    fee: resolveFee(t.price, nameOf(t.seller), nameOf(t.buyer)).fee,
  }));
  return { transfers: moves, valuations, players };
}

/**
 * Squad value of a club in a season, see the rules above.
 *
 * @param {string} clubId Mongo id of the Club
 * @param {string} seasonId Mongo id of the Season
 * @returns {Promise<object | null>} null when the club or the season does not exist
 */
async function getSquadValue(clubId, seasonId) {
  const [club, season, newest] = await Promise.all([
    Club.findById(clubId, { name: 1 }).lean(),
    Season.findById(seasonId, { period: 1, startDate: 1, endDate: 1 }).lean(),
    MarketValue.findOne({}, { date: 1 }).sort({ date: -1 }).lean(),
  ]);
  if (!club || !season) return null;

  const squadDate = season.endDate;
  const referenceDate = referenceDateOf(season, newest);
  const data = await loadSquadData(club._id, squadDate);

  return {
    club: { id: String(club._id), name: club.name },
    season: { id: String(season._id), period: season.period },
    referenceDate,
    ...computeSquad({ clubId: club._id, squadDate, referenceDate, ...data }),
  };
}

/**
 * Total squad value of a club in each season it played (its ClubSeason
 * rows), oldest first, for the evolution chart. Same rules as getSquadValue.
 *
 * @param {string} clubId Mongo id of the Club
 * @returns {Promise<object | null>} null when the club does not exist
 */
async function getSquadValueHistory(clubId) {
  const [club, newest] = await Promise.all([
    Club.findById(clubId, { name: 1 }).lean(),
    MarketValue.findOne({}, { date: 1 }).sort({ date: -1 }).lean(),
  ]);
  if (!club) return null;

  const seasonIds = await ClubSeason.distinct("season", { club: club._id });
  const seasons = await Season.find({ _id: { $in: seasonIds } }, { period: 1, startDate: 1, endDate: 1 })
    .sort({ startDate: 1 })
    .lean();

  const lastEnd = seasons.reduce((max, s) => (time(s.endDate) > time(max) ? s.endDate : max), new Date(0));
  const data = seasons.length > 0 ? await loadSquadData(club._id, lastEnd) : { transfers: [], valuations: [], players: [] };

  return {
    club: { id: String(club._id), name: club.name },
    seasons: seasons.map((season) => {
      const referenceDate = referenceDateOf(season, newest);
      const { totals } = computeSquad({
        clubId: club._id,
        squadDate: season.endDate,
        referenceDate,
        transfers: data.transfers,
        valuations: data.valuations.filter((v) => time(v.date) <= time(referenceDate)),
        players: data.players,
      });
      return {
        season: { id: String(season._id), period: season.period },
        referenceDate,
        totalValue: totals.totalValue,
        playerCount: totals.playerCount,
        valuedPlayerCount: totals.valuedPlayerCount,
      };
    }),
  };
}

module.exports = { POSITIONS, computeSquad, getSquadValue, getSquadValueHistory };
