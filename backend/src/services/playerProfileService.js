const Player = require("../models/Player");
const Transfer = require("../models/Transfer");
const MarketValue = require("../models/MarketValue");

/**
 * Shapes a market value document for the API, or null when there is none.
 *
 * @param {{ value: number, date: Date } | null} doc
 */
function toMarketValue(doc) {
  return doc ? { value: doc.value, date: doc.date } : null;
}

/**
 * Loads a player's profile: identity from the linked Person, the current
 * club (buyer of the latest transfer), and the latest and peak market values.
 *
 * @param {string} id Mongo id of the Player
 * @returns {Promise<object | null>} null when no player has this id
 */
async function getPlayerProfile(id) {
  const player = await Player.findById(id).populate("person").lean();
  if (!player) return null;

  const [latestTransfer, latestMarketValue, peakMarketValue] = await Promise.all([
    Transfer.findOne({ player: player._id }).sort({ date: -1 }).populate("buyer", "name").lean(),
    MarketValue.findOne({ player: player._id }).sort({ date: -1 }).lean(),
    // On equal values, the most recent peak wins
    MarketValue.findOne({ player: player._id }).sort({ value: -1, date: -1 }).lean(),
  ]);

  const club = latestTransfer && latestTransfer.buyer;
  return {
    id: String(player._id),
    name: player.person.name,
    birthDate: player.person.birthDate,
    nationality: player.person.nationality,
    currentClub: club ? { id: String(club._id), name: club.name } : null,
    latestMarketValue: toMarketValue(latestMarketValue),
    peakMarketValue: toMarketValue(peakMarketValue),
  };
}

module.exports = { getPlayerProfile };
