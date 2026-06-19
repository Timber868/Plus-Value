const { openConnection } = require("../duckdb/client");
const { sqlString } = require("./standingsReader");

/**
 * Reads the distinct seasons a competition has games for, from the local DuckDB
 * snapshot's `games` table. Used by the orchestrator's backfill mode to sync
 * every historical season of a league rather than just the latest one.
 *
 * @param {object} params
 * @param {string} params.competitionId Competition code, e.g. "FR1".
 * @param {string} [params.dbPath] Path to a `.duckdb` file (defaults to the
 *   production snapshot).
 * @returns {Promise<Array<string>>} Season start years (e.g. "2024"), ascending.
 */
async function readSeasons({ competitionId, dbPath }) {
  const { instance, connection } = await openConnection(dbPath);
  try {
    const reader = await connection.runAndReadAll(
      `SELECT DISTINCT season AS "season"
       FROM games
       WHERE competition_id = ${sqlString(competitionId)}
       ORDER BY "season"`,
    );
    return reader.getRowObjects().map((row) => String(row.season));
  } finally {
    // Release file handles eagerly: on Windows the OS holds an exclusive lock
    // on the .duckdb file until both the connection and the instance close.
    connection.closeSync();
    instance.closeSync();
  }
}

module.exports = { readSeasons };
