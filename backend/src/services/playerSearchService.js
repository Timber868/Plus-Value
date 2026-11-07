const mongoose = require("mongoose");
const Person = require("../models/Person");
const Player = require("../models/Player");
const Transfer = require("../models/Transfer");
const Club = require("../models/Club");
const MarketValue = require("../models/MarketValue");
const { getCurrentValueCutoff, currentOrNull } = require("./marketValueCutoff");

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MIN_QUERY_LENGTH = 2;

// Accented variants for each base letter, so "mbappe" also matches "Mbappé"
const ACCENT_VARIANTS = {
  a: "aàáâãäåā",
  c: "cçćč",
  e: "eèéêëēė",
  i: "iìíîïī",
  n: "nñń",
  o: "oòóôõöøō",
  u: "uùúûüū",
  y: "yýÿ",
  s: "sšś",
  z: "zžź",
};

/**
 * Builds a case and accent insensitive regular expression that matches the
 * query anywhere in a name. Accents are stripped from the query, then each
 * letter is widened to its accented variants; regex characters are escaped.
 *
 * @param {string} query
 * @returns {RegExp}
 */
function buildNameRegex(query) {
  const base = query.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const pattern = Array.from(base)
    .map((char) => {
      if (ACCENT_VARIANTS[char]) return `[${ACCENT_VARIANTS[char]}]`;
      return char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("");
  return new RegExp(pattern, "i");
}

/**
 * Validates the raw query string parameters of GET /api/players.
 *
 * @param {{ q?: string, club?: string, limit?: string }} raw
 * @returns {{ error: string } | { query: string, clubId: string | null, limit: number }}
 */
function parseSearchParams(raw) {
  const query = typeof raw.q === "string" ? raw.q.trim() : "";
  if (query.length < MIN_QUERY_LENGTH) {
    return { error: `Query parameter q must have at least ${MIN_QUERY_LENGTH} characters` };
  }

  let clubId = null;
  if (raw.club !== undefined) {
    if (!mongoose.isValidObjectId(raw.club)) return { error: "Invalid club" };
    clubId = String(raw.club);
  }

  let limit = DEFAULT_LIMIT;
  if (raw.limit !== undefined) {
    limit = Number(raw.limit);
    if (!Number.isInteger(limit) || limit < 1) return { error: "Invalid limit" };
    limit = Math.min(limit, MAX_LIMIT);
  }

  return { query, clubId, limit };
}

/**
 * Aggregation pipeline on the Person collection: matching names, joined to
 * their Player (owners drop out), the buyer of the latest transfer as the
 * current club, and the latest market value.
 *
 * @param {{ query: string, clubId: string | null, limit: number }} params
 * @returns {Array<object>}
 */
function buildSearchPipeline({ query, clubId, limit }) {
  const pipeline = [
    { $match: { name: buildNameRegex(query) } },
    {
      $lookup: {
        from: Player.collection.name,
        localField: "_id",
        foreignField: "person",
        as: "player",
      },
    },
    { $unwind: "$player" },
    {
      $lookup: {
        from: Transfer.collection.name,
        let: { playerId: "$player._id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$player", "$$playerId"] } } },
          { $sort: { date: -1 } },
          { $limit: 1 },
          { $project: { buyer: 1 } },
        ],
        as: "latestTransfer",
      },
    },
    {
      $lookup: {
        from: Club.collection.name,
        localField: "latestTransfer.buyer",
        foreignField: "_id",
        as: "currentClub",
      },
    },
  ];

  if (clubId) {
    pipeline.push({ $match: { "currentClub._id": new mongoose.Types.ObjectId(clubId) } });
  }

  pipeline.push(
    { $sort: { name: 1 } },
    { $limit: limit },
    {
      $lookup: {
        from: MarketValue.collection.name,
        let: { playerId: "$player._id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$player", "$$playerId"] } } },
          { $sort: { date: -1 } },
          { $limit: 1 },
        ],
        as: "latestMarketValue",
      },
    },
  );

  return pipeline;
}

/**
 * Shapes one aggregation row into the API response item. The latest market
 * value is dropped (null) when it is older than the current market window.
 *
 * @param {object} row
 * @param {Date | null} cutoff See marketValueCutoff.getCurrentValueCutoff
 */
function toSearchResult(row, cutoff) {
  const club = row.currentClub[0];
  const marketValue = row.latestMarketValue[0];
  return {
    id: String(row.player._id),
    name: row.name,
    nationality: row.nationality,
    currentClub: club ? { id: String(club._id), name: club.name } : null,
    latestMarketValue: currentOrNull(
      marketValue ? { value: marketValue.value, date: marketValue.date } : null,
      cutoff,
    ),
  };
}

/**
 * Searches players by name, optionally only those whose current club is `clubId`.
 *
 * @param {{ query: string, clubId: string | null, limit: number }} params
 * @returns {Promise<Array<object>>}
 */
async function searchPlayers(params) {
  const [rows, cutoff] = await Promise.all([
    Person.aggregate(buildSearchPipeline(params)),
    getCurrentValueCutoff(),
  ]);
  return rows.map((row) => toSearchResult(row, cutoff));
}

module.exports = {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  buildNameRegex,
  parseSearchParams,
  buildSearchPipeline,
  toSearchResult,
  searchPlayers,
};
