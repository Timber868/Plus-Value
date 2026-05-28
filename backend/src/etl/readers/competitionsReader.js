const { openConnection } = require("../duckdb/client");

/**
 * Normalises a value that may be a DuckDB LIST column into a plain JS array.
 *
 * DuckDB's node-api returns LIST columns as `DuckDBListValue { items: [...] }`
 * rather than a plain array, which would break downstream mappers that call
 * `.filter` / `.map` directly on the value.
 *
 * Exported so unit tests can drive every branch without needing a real DB.
 *
 * @param {unknown} value Raw value from `getRowObjects()`.
 * @returns {Array<unknown>} Always returns an array (empty if `value` is
 *   `null`, `undefined`, or any unrecognised shape).
 */
function unwrapList(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.items)) return value.items;
  return [];
}

/**
 * Reads the `competitions` table from the local DuckDB snapshot and returns
 * rows already shaped for the League schema.
 *
 * Cosmetic transforms (field renames + the league/cup classification) live in
 * the SQL via `AS` aliases and a `CASE`, so the mapper only has to deal with
 * the genuinely branchy logic (tier extraction). Double-quoted aliases keep
 * DuckDB from lowercasing the camelCase identifiers.
 *
 * `dbPath` is a positional argument (rather than an options object) so the
 * function is trivially testable against a fixture file without needing to
 * mutate env vars. Passing `undefined` falls back to the default snapshot
 * location (see {@link defaultDbPath}).
 *
 * @param {string} [dbPath] Path to a `.duckdb` file.
 * @returns {Promise<Array<{
 *   competitionId: string,
 *   name: string,
 *   country: string|null,
 *   confederation: string|null,
 *   sub_type: Array<string|null>,
 *   competitionFormat: "league"|"cup"
 * }>>}
 */
async function readCompetitions(dbPath) {
  const { instance, connection } = await openConnection(dbPath);
  try {
    const reader = await connection.runAndReadAll(
      `SELECT
         competition_id AS "competitionId",
         name,
         country_name   AS country,
         confederation,
         sub_type,
         CASE WHEN LOWER(type) LIKE '%cup%' THEN 'cup' ELSE 'league' END
           AS "competitionFormat"
       FROM competitions`,
    );
    const rows = reader.getRowObjects();
    return rows.map((row) => ({
      ...row,
      sub_type: unwrapList(row.sub_type),
    }));
  } finally {
    // Release file handles eagerly: on Windows the OS holds an exclusive lock
    // on the .duckdb file until both the connection and the instance close.
    connection.closeSync();
    instance.closeSync();
  }
}

module.exports = { readCompetitions, unwrapList };
