const path = require("path");
const mongoose = require("mongoose");
const League = require("../models/League");
const Season = require("../models/Season");
const Club = require("../models/Club");
const ClubSeason = require("../models/ClubSeason");
const Person = require("../models/Person");
const Player = require("../models/Player");
const Transfer = require("../models/Transfer");
const MarketValue = require("../models/MarketValue");
const demo = require("./demo/demoData");

/**
 * Loads the demo data set (demo/demoData.js) into the connected database.
 *
 * Safe to run twice: leagues, seasons, clubs and players are upserted by
 * their natural keys, and the demo players' transfers and valuations are
 * replaced. Nothing else in the database is touched.
 *
 * @returns {Promise<{ clubs: number, seasons: number, players: number, transfers: number, valuations: number }>}
 */
async function seed() {
  const league = await League.findOneAndUpdate(
    { competitionId: demo.LEAGUE.competitionId },
    { $set: demo.LEAGUE },
    { upsert: true, new: true },
  );

  const seasonByPeriod = new Map();
  for (const s of demo.SEASONS) {
    const startDate = new Date(s.start);
    const endDate = new Date(s.end);
    const period = `${startDate.getUTCFullYear()}/${endDate.getUTCFullYear()}`;
    let season = await Season.findOne({ league: league._id, period });
    if (!season) season = await Season.create({ league: league._id, startDate, endDate });
    seasonByPeriod.set(period, season);
  }

  const clubById = new Map();
  for (const c of demo.CLUBS) {
    const club = await Club.findOneAndUpdate(
      { clubId: c.clubId },
      { $set: { name: c.name, country: c.country, isExternal: Boolean(c.isExternal) } },
      { upsert: true, new: true },
    );
    clubById.set(c.clubId, club);
    if (c.inLeague) {
      for (const season of seasonByPeriod.values()) {
        await ClubSeason.updateOne({ club: club._id, season: season._id }, { $setOnInsert: { points: 0 } }, { upsert: true });
      }
    }
  }

  const playerById = new Map();
  for (const p of demo.PLAYERS) {
    const personFields = { name: p.name, birthDate: new Date(p.birthDate), nationality: p.nationality };
    let player = await Player.findOne({ playerId: p.playerId });
    if (player) {
      await Person.updateOne({ _id: player.person }, { $set: personFields });
      player.position = p.position;
      player.subPosition = p.subPosition;
      await player.save();
    } else {
      const person = await Person.create(personFields);
      player = await Player.create({ playerId: p.playerId, person: person._id, position: p.position, subPosition: p.subPosition });
    }
    playerById.set(p.playerId, player);
  }

  const playerIds = [...playerById.values()].map((p) => p._id);
  await Transfer.deleteMany({ player: { $in: playerIds } });
  await MarketValue.deleteMany({ player: { $in: playerIds } });

  await Transfer.insertMany(
    demo.TRANSFERS.map((t) => ({
      player: playerById.get(t.player)._id,
      seller: t.seller ? clubById.get(t.seller)._id : undefined,
      buyer: clubById.get(t.buyer)._id,
      season: seasonByPeriod.get(t.season)._id,
      date: new Date(t.date),
      ...(t.fee === null ? {} : { price: t.fee }),
    })),
  );
  await MarketValue.insertMany(
    demo.VALUATIONS.map((v) => ({ player: playerById.get(v.player)._id, date: new Date(v.date), value: v.value })),
  );

  return {
    clubs: clubById.size,
    seasons: seasonByPeriod.size,
    players: playerById.size,
    transfers: demo.TRANSFERS.length,
    valuations: demo.VALUATIONS.length,
  };
}

/**
 * Refuses remote databases (MongoDB Atlas) unless SEED_ALLOW_REMOTE=1, since
 * the demo data is meant for a local MongoDB.
 *
 * @param {string | undefined} uri
 * @param {{ SEED_ALLOW_REMOTE?: string }} env
 * @returns {string | null} an error message, or null when seeding may go ahead
 */
function checkTarget(uri, env) {
  if (!uri) return "MONGODB_URI is not set. Point it at a local MongoDB, e.g. mongodb://127.0.0.1:27017.";
  if (uri.startsWith("mongodb+srv://") && env.SEED_ALLOW_REMOTE !== "1") {
    return "MONGODB_URI points at a remote database. Use a local MongoDB, or set SEED_ALLOW_REMOTE=1 to seed it anyway.";
  }
  return null;
}

// CLI entry point: `npm run seed:demo`. Excluded from coverage because the
// body is pure environment plumbing.
/* istanbul ignore next */
if (require.main === module) {
  require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });
  const error = checkTarget(process.env.MONGODB_URI, process.env);
  if (error) {
    console.error(error);
    process.exitCode = 1;
  } else {
    mongoose
      .connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB || "plusvalue" })
      .then(() => seed())
      .then((stats) => console.log("Demo data loaded:", stats))
      .catch((err) => {
        console.error(err);
        process.exitCode = 1;
      })
      .finally(() => mongoose.disconnect());
  }
}

module.exports = { seed, checkTarget };
