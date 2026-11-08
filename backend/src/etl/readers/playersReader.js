const { openConnection } = require("../duckdb/client");

/**
 * Reads every player from the local DuckDB snapshot, shaped for the player
 * mapper. Only the columns that feed the Person + Player models are selected;
 * the many other `players` columns (height, market value, ...) are
 * intentionally ignored.
 *
 * `player_id` is cast to VARCHAR to match `Player.playerId`, and
 * `date_of_birth` (a TIMESTAMP) is rendered as a plain 'YYYY-MM-DD' string so
 * the node-api returns strings/NULLs instead of driver-specific timestamp
 * objects. Rows with NULL fields are returned as-is; the mapper's validation
 * decides what to skip.
 *
 * @param {object} params
 * @param {string} [params.dbPath] Path to a `.duckdb` file (defaults to the
 *   production snapshot).
 * @returns {Promise<Array<{
 *   playerId: string,
 *   name: string|null,
 *   birthDate: string|null,
 *   nationality: string|null,
 *   position: string|null,
 *   subPosition: string|null
 * }>>} Rows ordered by player id.
 */
async function readPlayers({ dbPath }) {
  const { instance, connection } = await openConnection(dbPath);
  try {
    const reader = await connection.runAndReadAll(
      `SELECT
         CAST(player_id AS VARCHAR)             AS "playerId",
         name,
         strftime(date_of_birth, '%Y-%m-%d')    AS "birthDate",
         country_of_citizenship                 AS "nationality",
         position,
         sub_position                           AS "subPosition"
       FROM players
       ORDER BY player_id`,
    );
    return reader.getRowObjects();
  } finally {
    // Release file handles eagerly: on Windows the OS holds an exclusive lock
    // on the .duckdb file until both the connection and the instance close.
    connection.closeSync();
    instance.closeSync();
  }
}

module.exports = { readPlayers };
