const { openConnection } = require("../duckdb/client");

/**
 * Reads every market value snapshot from the local DuckDB snapshot's
 * `player_valuations` table, shaped for the market value mapper.
 *
 * `player_id` is cast to VARCHAR to match `Player.playerId`, `date` (a DATE)
 * is rendered as a plain 'YYYY-MM-DD' string so the node-api returns strings
 * instead of driver-specific date objects, and the value is cast to INTEGER
 * so it arrives as a plain JS number.
 *
 * @param {object} params
 * @param {string} [params.dbPath] Path to a `.duckdb` file (defaults to the
 *   production snapshot).
 * @returns {Promise<Array<{
 *   playerId: string,
 *   date: string,
 *   value: number
 * }>>} Rows ordered by player id then date.
 */
async function readPlayerValuations({ dbPath }) {
  const { instance, connection } = await openConnection(dbPath);
  try {
    const reader = await connection.runAndReadAll(
      `SELECT
         CAST(player_id AS VARCHAR)          AS "playerId",
         strftime(date, '%Y-%m-%d')          AS "date",
         market_value_in_eur::INTEGER        AS "value"
       FROM player_valuations
       ORDER BY player_id, date`,
    );
    return reader.getRowObjects();
  } finally {
    // Release file handles eagerly: on Windows the OS holds an exclusive lock
    // on the .duckdb file until both the connection and the instance close.
    connection.closeSync();
    instance.closeSync();
  }
}

module.exports = { readPlayerValuations };
