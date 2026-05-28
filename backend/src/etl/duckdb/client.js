const path = require("path");
const { DuckDBInstance } = require("@duckdb/node-api");

/** Filename of the DuckDB snapshot produced by the dataset downloader job. */
const DB_FILENAME = "market-datasets.duckdb";

/**
 * Resolves the on-disk path of the DuckDB snapshot.
 *
 * Honours the `CUSTOM_DATA_DIR` env var (used by tests and by alternate data
 * pipelines) and otherwise falls back to `backend/data/`.
 *
 * @returns {string} Absolute path to the `.duckdb` file.
 */
function defaultDbPath() {
  const baseDir =
    process.env.CUSTOM_DATA_DIR ||
    path.join(__dirname, "..", "..", "..", "data");
  return path.join(baseDir, DB_FILENAME);
}

/**
 * Opens a DuckDB connection.
 *
 * Returns both the instance and the connection so the caller can release them
 * via `closeSync()` once finished. Failing to close leaves file handles open,
 * which on Windows blocks subsequent reads of the same file.
 *
 * @param {string} [dbPath] Path to a `.duckdb` file. Defaults to {@link defaultDbPath}.
 * @returns {Promise<{ instance: import("@duckdb/node-api").DuckDBInstance,
 *                      connection: import("@duckdb/node-api").DuckDBConnection }>}
 */
async function openConnection(dbPath = defaultDbPath()) {
  const instance = await DuckDBInstance.create(dbPath);
  const connection = await instance.connect();
  return { instance, connection };
}

module.exports = {
  DB_FILENAME,
  defaultDbPath,
  openConnection,
};
