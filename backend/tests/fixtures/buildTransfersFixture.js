const fs = require("fs");
const os = require("os");
const path = require("path");
const { DuckDBInstance } = require("@duckdb/node-api");

/**
 * @file Builds a tiny DuckDB file mirroring the shape of the production
 * `transfers` table (only the columns the transfers reader selects). Used by
 * the transfers reader unit test and the syncTransfers integration test so
 * they never touch real data.
 *
 * The rows exercise every path of the sync: an incoming transfer (external
 * seller), an outgoing sale (external buyer), a free transfer (NULL fee), a
 * transfer in a season that has not been synced (skipped), and a transfer of
 * a player missing from Mongo (skipped). Club "10" plays the role of the
 * already-synced Ligue 1 club; "88"/"99" are foreign clubs.
 */

/** Source rows keyed by the columns of the production table. */
const TRANSFERS = [
  {
    player_id: 1,
    transfer_date: "2024-08-15",
    transfer_season: "24/25",
    from_club_id: 99,
    to_club_id: 10,
    from_club_name: "Real Madrid",
    to_club_name: "Paris SG",
    transfer_fee: 180000000,
  },
  {
    player_id: 2,
    transfer_date: "2025-01-15",
    transfer_season: "24/25",
    from_club_id: 10,
    to_club_id: 88,
    from_club_name: "Paris SG",
    to_club_name: "Chelsea",
    transfer_fee: 50000000,
  },
  // Free transfer: NULL fee must load with no price.
  {
    player_id: 2,
    transfer_date: "2024-07-01",
    transfer_season: "24/25",
    from_club_id: 99,
    to_club_id: 10,
    from_club_name: "Real Madrid",
    to_club_name: "Paris SG",
    transfer_fee: null,
  },
  // Season "93/94" is never synced in Mongo: skipped as unresolved season.
  {
    player_id: 1,
    transfer_date: "1993-07-01",
    transfer_season: "93/94",
    from_club_id: 99,
    to_club_id: 10,
    from_club_name: "Real Madrid",
    to_club_name: "Paris SG",
    transfer_fee: 1000000,
  },
  // Player 77 does not exist in the players collection: skipped.
  {
    player_id: 77,
    transfer_date: "2024-08-15",
    transfer_season: "24/25",
    from_club_id: 99,
    to_club_id: 10,
    from_club_name: "Real Madrid",
    to_club_name: "Paris SG",
    transfer_fee: 500000,
  },
];

/**
 * Rows the reader is expected to return (camelCase, ids as strings, date as a
 * 'YYYY-MM-DD' string, fee as a plain number or null), ordered by player id
 * then date.
 */
const EXPECTED_ROWS = [
  {
    playerId: "1",
    date: "1993-07-01",
    season: "93/94",
    sellerClubId: "99",
    buyerClubId: "10",
    sellerName: "Real Madrid",
    buyerName: "Paris SG",
    fee: 1000000,
  },
  {
    playerId: "1",
    date: "2024-08-15",
    season: "24/25",
    sellerClubId: "99",
    buyerClubId: "10",
    sellerName: "Real Madrid",
    buyerName: "Paris SG",
    fee: 180000000,
  },
  {
    playerId: "2",
    date: "2024-07-01",
    season: "24/25",
    sellerClubId: "99",
    buyerClubId: "10",
    sellerName: "Real Madrid",
    buyerName: "Paris SG",
    fee: null,
  },
  {
    playerId: "2",
    date: "2025-01-15",
    season: "24/25",
    sellerClubId: "10",
    buyerClubId: "88",
    sellerName: "Paris SG",
    buyerName: "Chelsea",
    fee: 50000000,
  },
  {
    playerId: "77",
    date: "2024-08-15",
    season: "24/25",
    sellerClubId: "99",
    buyerClubId: "10",
    sellerName: "Real Madrid",
    buyerName: "Paris SG",
    fee: 500000,
  },
];

/** Fixture rows that load when players 1/2 and season 2024/2025 are synced. */
const LOADABLE_COUNT = 3;

/**
 * Quotes a scalar for inline interpolation into a DuckDB statement. Inline
 * interpolation is safe here because every input is hard-coded in this file.
 *
 * @param {string|number|null|undefined} value
 * @returns {string}
 */
function quote(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Renders a 'YYYY-MM-DD' string as a DuckDB DATE literal.
 *
 * @param {string} value
 * @returns {string}
 */
function dateLiteral(value) {
  return `DATE '${value}'`;
}

/**
 * Creates a `.duckdb` file at `targetPath` containing the `transfers` table
 * populated with the fixture rows above. Overwrites any existing file at
 * that location.
 *
 * @param {string} targetPath
 * @returns {Promise<string>} Echoes back `targetPath`.
 */
async function buildFixture(targetPath) {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { force: true });
  }

  const instance = await DuckDBInstance.create(targetPath);
  const connection = await instance.connect();

  await connection.run(`
    CREATE TABLE transfers (
      player_id INTEGER,
      transfer_date DATE,
      transfer_season VARCHAR,
      from_club_id INTEGER,
      to_club_id INTEGER,
      from_club_name VARCHAR,
      to_club_name VARCHAR,
      transfer_fee DECIMAL(18,3)
    );
  `);

  for (const t of TRANSFERS) {
    await connection.run(
      `INSERT INTO transfers VALUES (${quote(t.player_id)}, ${dateLiteral(t.transfer_date)}, ${quote(t.transfer_season)}, ${quote(t.from_club_id)}, ${quote(t.to_club_id)}, ${quote(t.from_club_name)}, ${quote(t.to_club_name)}, ${quote(t.transfer_fee)});`,
    );
  }

  connection.closeSync?.();
  instance.closeSync?.();

  return targetPath;
}

/**
 * Allocates a fresh temp directory and returns a unique path for a fixture
 * file, so parallel tests do not lock each other out.
 *
 * @param {string} label Short identifier embedded in the temp directory name.
 * @returns {string} Absolute path to a `transfers.duckdb` location.
 */
function freshFixturePath(label) {
  const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), `plusvalue-transfers-${label}-`),
  );
  return path.join(dir, "transfers.duckdb");
}

module.exports = {
  TRANSFERS,
  EXPECTED_ROWS,
  LOADABLE_COUNT,
  buildFixture,
  freshFixturePath,
};
