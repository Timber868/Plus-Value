const fs = require("fs");
const os = require("os");
const path = require("path");
const { DuckDBInstance } = require("@duckdb/node-api");

/**
 * @file Builds a tiny DuckDB file mirroring the shape of the production
 * `players` table (only the columns the players reader selects). Used by the
 * players reader unit test and the syncPlayers integration test so they never
 * touch real data.
 *
 * Two rows are fully valid; three are missing one required Person field each
 * (birth date, nationality, name) and must be skipped by the job's mapper
 * validation.
 */

/** Source rows keyed by the columns of the production `players` table. */
const PLAYERS = [
  {
    player_id: 1,
    name: "Kylian Mbappé",
    date_of_birth: "1998-12-20",
    country_of_citizenship: "France",
    position: "Attack",
    sub_position: "Centre-Forward",
  },
  {
    player_id: 2,
    name: "Erling Haaland",
    date_of_birth: "2000-07-21",
    country_of_citizenship: "Norway",
    position: "Attack",
    sub_position: "Centre-Forward",
  },
  {
    player_id: 3,
    name: "No Birth Date",
    date_of_birth: null,
    country_of_citizenship: "France",
    position: "Missing",
    sub_position: null,
  },
  {
    player_id: 4,
    name: "No Nationality",
    date_of_birth: "1990-01-01",
    country_of_citizenship: null,
    position: null,
    sub_position: null,
  },
  {
    player_id: 5,
    name: null,
    date_of_birth: "1985-05-05",
    country_of_citizenship: "Spain",
    position: "Midfield",
    sub_position: "Central Midfield",
  },
];

/**
 * Rows the reader is expected to return (camelCase, playerId as string,
 * birthDate as a 'YYYY-MM-DD' string or null), ordered by player_id.
 */
const EXPECTED_ROWS = [
  { playerId: "1", name: "Kylian Mbappé", birthDate: "1998-12-20", nationality: "France", position: "Attack", subPosition: "Centre-Forward" },
  { playerId: "2", name: "Erling Haaland", birthDate: "2000-07-21", nationality: "Norway", position: "Attack", subPosition: "Centre-Forward" },
  { playerId: "3", name: "No Birth Date", birthDate: null, nationality: "France", position: "Missing", subPosition: null },
  { playerId: "4", name: "No Nationality", birthDate: "1990-01-01", nationality: null, position: null, subPosition: null },
  { playerId: "5", name: null, birthDate: "1985-05-05", nationality: "Spain", position: "Midfield", subPosition: "Central Midfield" },
];

/** How many fixture rows survive mapper validation (all Person fields set). */
const VALID_COUNT = 2;

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
 * Renders a 'YYYY-MM-DD' string (or null) as a DuckDB TIMESTAMP literal,
 * matching the TIMESTAMP type of the production `date_of_birth` column.
 *
 * @param {string|null} value
 * @returns {string}
 */
function timestampLiteral(value) {
  if (value === null || value === undefined) return "NULL";
  return `TIMESTAMP '${value} 00:00:00'`;
}

/**
 * Creates a `.duckdb` file at `targetPath` containing the `players` table
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
    CREATE TABLE players (
      player_id INTEGER,
      name VARCHAR,
      date_of_birth TIMESTAMP,
      country_of_citizenship VARCHAR,
      position VARCHAR,
      sub_position VARCHAR
    );
  `);

  for (const p of PLAYERS) {
    await connection.run(
      `INSERT INTO players VALUES (${quote(p.player_id)}, ${quote(p.name)}, ${timestampLiteral(p.date_of_birth)}, ${quote(p.country_of_citizenship)}, ${quote(p.position)}, ${quote(p.sub_position)});`,
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
 * @returns {string} Absolute path to a `players.duckdb` location.
 */
function freshFixturePath(label) {
  const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), `plusvalue-players-${label}-`),
  );
  return path.join(dir, "players.duckdb");
}

module.exports = {
  PLAYERS,
  EXPECTED_ROWS,
  VALID_COUNT,
  buildFixture,
  freshFixturePath,
};
