const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

/**
 * @file Thin wrapper around `mongodb-memory-server` for integration tests.
 * Spins up an in-process MongoDB on `start()`, tears it down on `stop()`,
 * and provides a `clearAll()` helper for `beforeEach` isolation between tests.
 */

let mongod;

/**
 * Starts an in-memory MongoDB and connects Mongoose to it. Should be called
 * once from `beforeAll` in an integration test file.
 *
 * @returns {Promise<void>}
 */
async function start() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}

/**
 * Disconnects Mongoose and stops the in-memory MongoDB. Should be called
 * once from `afterAll`.
 *
 * @returns {Promise<void>}
 */
async function stop() {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

/**
 * Empties every collection on the active connection. Useful in `beforeEach`
 * to guarantee a clean slate without paying the cost of restarting the server.
 *
 * @returns {Promise<void>}
 */
async function clearAll() {
  const { collections } = mongoose.connection;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}

module.exports = { start, stop, clearAll };
