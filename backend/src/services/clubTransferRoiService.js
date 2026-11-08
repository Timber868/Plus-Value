const Club = require("../models/Club");
const Transfer = require("../models/Transfer");
const MarketValue = require("../models/MarketValue");
const { getCurrentValueCutoff } = require("./marketValueCutoff");
const { findExitTransfer, computeTransferRoi } = require("./transferRoi");

/**
 * Shapes a populated club reference for the API, or null when absent.
 *
 * @param {{ _id: *, name: string } | null | undefined} club
 */
function toClub(club) {
  return club ? { id: String(club._id), name: club.name } : null;
}

/**
 * Sums the numbers of a list, skipping nulls.
 *
 * @param {Array<number | null>} values
 */
function sumKnown(values) {
  return values.reduce((sum, v) => (v === null ? sum : sum + v), 0);
}

/**
 * Club totals over the per-transfer ROI rows. Unknown amounts are left out
 * of every sum, so netGain only covers transfers whose gain is known.
 *
 * @param {Array<{ feePaid: number | null, exit: { type: string, value: number | null }, gain: number | null }>} rows
 */
function computeTotals(rows) {
  return {
    totalSpent: sumKnown(rows.map((r) => r.feePaid)),
    totalCurrentValue: sumKnown(rows.filter((r) => r.exit.type === "marketValue").map((r) => r.exit.value)),
    totalResaleIncome: sumKnown(rows.filter((r) => r.exit.type === "resale").map((r) => r.exit.value)),
    netGain: sumKnown(rows.map((r) => r.gain)),
  };
}

/**
 * Lists a club's incoming transfers (oldest first) with the ROI figures of
 * each one (see transferRoi.js), plus club totals.
 *
 * @param {string} clubId Mongo id of the Club
 * @param {{ seasonId?: string | null }} [options] only transfers of this season
 * @returns {Promise<{ transfers: object[], totals: object } | null>} null when no club has this id
 */
async function getClubTransferRoi(clubId, { seasonId = null } = {}) {
  if (!(await Club.exists({ _id: clubId }))) return null;

  const filter = { buyer: clubId };
  if (seasonId) filter.season = seasonId;

  const incoming = await Transfer.find(filter)
    .sort({ date: 1 })
    .populate({ path: "player", select: "person", populate: { path: "person", select: "name" } })
    .populate("seller", "name")
    .lean();

  const playerIds = [...new Set(incoming.map((t) => String(t.player._id)))];
  const [playerTransfers, valuations, currentCutoff] = await Promise.all([
    Transfer.find({ player: { $in: playerIds } }, { player: 1, date: 1, price: 1 }).lean(),
    MarketValue.find({ player: { $in: playerIds } }, { player: 1, date: 1, value: 1 }).lean(),
    getCurrentValueCutoff(),
  ]);

  const transfersByPlayer = groupByPlayer(playerTransfers.map((t) => ({ ...t, fee: t.price ?? null })));
  const valuationsByPlayer = groupByPlayer(valuations);

  const transfers = incoming.map((t) => {
    const playerId = String(t.player._id);
    const roi = computeTransferRoi({
      transfer: { date: t.date, fee: t.price ?? null },
      valuations: valuationsByPlayer.get(playerId) || [],
      exitTransfer: findExitTransfer(t, transfersByPlayer.get(playerId) || []),
      currentCutoff,
    });
    return {
      player: { id: playerId, name: t.player.person ? t.player.person.name : null },
      date: t.date,
      fromClub: toClub(t.seller),
      ...roi,
    };
  });

  return { transfers, totals: computeTotals(transfers) };
}

/**
 * Groups documents by their player id.
 *
 * @param {Array<{ player: * }>} docs
 * @returns {Map<string, object[]>}
 */
function groupByPlayer(docs) {
  const groups = new Map();
  for (const doc of docs) {
    const key = String(doc.player);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(doc);
  }
  return groups;
}

module.exports = { computeTotals, getClubTransferRoi };
