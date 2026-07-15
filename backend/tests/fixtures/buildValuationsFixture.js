const fs = require("fs");
const os = require("os");
const path = require("path");
const { DuckDBInstance } = require("@duckdb/node-api");

/**
 * @file Builds a tiny DuckDB file mirroring the shape of the production
 * `player_valuations` table (only the columns the valuations reader selects).
 * Used by the valuations reader unit test and the syncMarketValues
 * integration test so they never touch real data.
 *
 * Three rows are valid snapshots for players "1" and "2"; one row has a
 * negative value (must be skipped by mapper validation) and one row belongs
 * to a player id that is never synced (must be skipped as unresolved).
 */

/** Source rows keyed by the columns of the production table. */
const VALUATIONS = [
  { player_id: 1, date: "2024-08-01", market_value_in_eur: 150000000 },
  { player_id: 1, date: "2025-02-01", market_value_in_eur: 180000000 },
  { player_id: 2, date: "2024-08-01", market_value_in_eur: 200000000 },
  // Negative value: invalid for the MarketValue schema (min 0).
  { player_id: 1, date: "2023-01-01", market_value_in_eur: -5 },
  // Player 99 does not exist in the players collection.
  { player_id: 99, date: "2024-08-01", market_value_in_eur: 1000000 },
];

/**
 * Rows the reader is expected to return (camelCase, playerId as string,
 * date as a 'YYYY-MM-DD' string), ordered by player id then date.
 */
const EXPECTED_ROWS = [
  { playerId: "1", date: "2023-01-01", value: -5 },
  { playerId: "1", date: "2024-08-01", value: 150000000 },
  { playerId: "1", date: "2025-02-01", value: 180000000 },
  { playerId: "2", date: "2024-08-01", value: 200000000 },
  { playerId: "99", date: "2024-08-01", value: 1000000 },
];

/** Fixture rows that survive validation AND belong to synced players 1/2. */
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
 * Creates a `.duckdb` file at `targetPath` containing the `player_valuations`
 * table populated with the fixture rows above. Overwrites any existing file
 * at that location.
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
    CREATE TABLE player_valuations (
      player_id INTEGER,
      date DATE,
      market_value_in_eur INTEGER
    );
  `);

  for (const v of VALUATIONS) {
    await connection.run(
      `INSERT INTO player_valuations VALUES (${quote(v.player_id)}, DATE ${quote(v.date)}, ${quote(v.market_value_in_eur)});`,
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
 * @returns {string} Absolute path to a `valuations.duckdb` location.
 */
function freshFixturePath(label) {
  const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), `plusvalue-valuations-${label}-`),
  );
  return path.join(dir, "valuations.duckdb");
}

module.exports = {
  VALUATIONS,
  EXPECTED_ROWS,
  LOADABLE_COUNT,
  buildFixture,
  freshFixturePath,
};
