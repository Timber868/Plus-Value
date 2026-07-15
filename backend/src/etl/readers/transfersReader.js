const { openConnection } = require("../duckdb/client");

/**
 * Reads every transfer from the local DuckDB snapshot's `transfers` table,
 * shaped for the transfer mapper.
 *
 * Ids are cast to VARCHAR to match the Mongo natural keys (`Player.playerId`,
 * `Club.clubId`), `transfer_date` (a DATE) is rendered as a plain
 * 'YYYY-MM-DD' string, and the DECIMAL(18,3) `transfer_fee` is cast to DOUBLE
 * so it arrives as a plain JS number (NULL for free/undisclosed transfers).
 * Club names ride along so unknown transfer partners can be created as
 * external clubs.
 *
 * @param {object} params
 * @param {string} [params.dbPath] Path to a `.duckdb` file (defaults to the
 *   production snapshot).
 * @returns {Promise<Array<{
 *   playerId: string,
 *   date: string,
 *   season: string,
 *   sellerClubId: string|null,
 *   buyerClubId: string|null,
 *   sellerName: string|null,
 *   buyerName: string|null,
 *   fee: number|null
 * }>>} Rows ordered by player id then date.
 */
async function readTransfers({ dbPath }) {
  const { instance, connection } = await openConnection(dbPath);
  try {
    const reader = await connection.runAndReadAll(
      `SELECT
         CAST(player_id AS VARCHAR)          AS "playerId",
         strftime(transfer_date, '%Y-%m-%d') AS "date",
         transfer_season                     AS "season",
         CAST(from_club_id AS VARCHAR)       AS "sellerClubId",
         CAST(to_club_id AS VARCHAR)         AS "buyerClubId",
         from_club_name                      AS "sellerName",
         to_club_name                        AS "buyerName",
         transfer_fee::DOUBLE                AS "fee"
       FROM transfers
       ORDER BY player_id, transfer_date`,
    );
    return reader.getRowObjects();
  } finally {
    // Release file handles eagerly: on Windows the OS holds an exclusive lock
    // on the .duckdb file until both the connection and the instance close.
    connection.closeSync();
    instance.closeSync();
  }
}

module.exports = { readTransfers };
