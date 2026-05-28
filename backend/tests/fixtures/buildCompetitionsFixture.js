const fs = require("fs");
const os = require("os");
const path = require("path");
const { DuckDBInstance } = require("@duckdb/node-api");

/**
 * @file Builds a tiny DuckDB file mirroring the shape of the production
 * `competitions` table. Used by the reader unit tests and by the
 * syncLeagues integration test so they never touch real data.
 */

/**
 * Hand-picked rows that collectively exercise every branch in the league
 * pipeline:
 *
 *  - `FR1`: top-tier league                        (toTier → 1, format → league)
 *  - `GB2`: second-tier league                     (toTier → 2)
 *  - `DFB`: domestic cup, no tier keyword          (toTier → undefined, format → cup)
 *  - `BAD`: missing confederation                  (isValidLeagueDoc → false, skipped)
 *  - `MIX`: sub_type has nulls + a tier keyword    (drives the `.filter(Boolean)` branch)
 */
const SAMPLE_ROWS = [
  {
    competition_id: "FR1",
    name: "Ligue 1",
    sub_type: ["first_tier"],
    type: "domestic_league",
    country_name: "France",
    confederation: "UEFA",
  },
  {
    competition_id: "GB2",
    name: "Championship",
    sub_type: ["second_tier"],
    type: "domestic_league",
    country_name: "England",
    confederation: "UEFA",
  },
  {
    competition_id: "DFB",
    name: "DFB-Pokal",
    sub_type: ["knockout"],
    type: "domestic_cup",
    country_name: "Germany",
    confederation: "UEFA",
  },
  {
    competition_id: "BAD",
    name: "Missing Confederation League",
    sub_type: ["first_tier"],
    type: "domestic_league",
    country_name: "Nowhere",
    confederation: null,
  },
  {
    competition_id: "MIX",
    name: "Mixed Subtype League",
    sub_type: [null, "", "third_tier"],
    type: "domestic_league",
    country_name: "Spain",
    confederation: "UEFA",
  },
];

/**
 * Quotes a scalar value for inline interpolation into a DuckDB SQL statement.
 * Returns the literal `NULL` (unquoted) for nullish input and escapes single
 * quotes by doubling them.
 *
 * Inline interpolation is safe here because every input is hard-coded in this
 * file — do not reuse this helper for untrusted data.
 *
 * @param {string|number|null|undefined} value
 * @returns {string}
 */
function quote(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Renders a JS array as a DuckDB list literal, e.g. `['a', NULL, 'b']`.
 *
 * @param {Array<string|null|undefined>|null|undefined} arr
 * @returns {string}
 */
function quoteArray(arr) {
  if (!arr) return "NULL";
  const cleaned = arr.map((v) => (v === null || v === undefined ? "NULL" : quote(v)));
  return `[${cleaned.join(", ")}]`;
}

/**
 * Creates a `.duckdb` file at `targetPath` containing a `competitions` table
 * populated with {@link SAMPLE_ROWS}. Overwrites any existing file at that
 * location.
 *
 * @param {string} targetPath Where the new `.duckdb` file should be written.
 * @returns {Promise<string>} Echoes back `targetPath` for chaining.
 */
async function buildFixture(targetPath) {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { force: true });
  }

  const instance = await DuckDBInstance.create(targetPath);
  const connection = await instance.connect();

  await connection.run(`
    CREATE TABLE competitions (
      competition_id VARCHAR,
      name VARCHAR,
      sub_type VARCHAR[],
      type VARCHAR,
      country_name VARCHAR,
      confederation VARCHAR
    );
  `);

  for (const row of SAMPLE_ROWS) {
    await connection.run(`
      INSERT INTO competitions VALUES (
        ${quote(row.competition_id)},
        ${quote(row.name)},
        ${quoteArray(row.sub_type)},
        ${quote(row.type)},
        ${quote(row.country_name)},
        ${quote(row.confederation)}
      );
    `);
  }

  // Optional chaining: closeSync was added later in @duckdb/node-api and is
  // missing in some pre-release builds. Best-effort close is fine here.
  connection.closeSync?.();
  instance.closeSync?.();

  return targetPath;
}

/**
 * Allocates a fresh temp directory and returns a path inside it where a new
 * fixture file can be built. Each call returns a unique path so parallel
 * tests can build independent fixtures without locking each other out.
 *
 * @param {string} label Short identifier embedded in the temp directory name;
 *   makes it easier to attribute leftover files to the right test if cleanup
 *   ever fails.
 * @returns {string} Absolute path to a `competitions.duckdb` location.
 */
function freshFixturePath(label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `plusvalue-fixture-${label}-`));
  return path.join(dir, "competitions.duckdb");
}

module.exports = {
  SAMPLE_ROWS,
  buildFixture,
  freshFixturePath,
};
