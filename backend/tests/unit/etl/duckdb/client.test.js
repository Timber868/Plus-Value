/**
 * @file Tests for the DuckDB connection helper. `@duckdb/node-api` is mocked
 * so we never touch the filesystem and can drive the no-args / explicit-path
 * branches cheaply.
 */

const path = require("path");

jest.mock("@duckdb/node-api", () => ({
  DuckDBInstance: {
    create: jest.fn().mockResolvedValue({
      connect: jest.fn().mockResolvedValue({ marker: "conn" }),
    }),
  },
}));

const { DuckDBInstance } = require("@duckdb/node-api");
const { defaultDbPath, DB_FILENAME, openConnection } = require("../../../../src/etl/duckdb/client");

/** Resolves the on-disk path of the DuckDB snapshot. */
describe("defaultDbPath", () => {
  // The env var is process-global, so snapshot the original value and
  // restore it after each test to avoid leaking state into other suites.
  const originalEnv = process.env.CUSTOM_DATA_DIR;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.CUSTOM_DATA_DIR;
    } else {
      process.env.CUSTOM_DATA_DIR = originalEnv;
    }
  });

  test("uses CUSTOM_DATA_DIR when set", () => {
    process.env.CUSTOM_DATA_DIR = path.join("custom", "data");
    expect(defaultDbPath()).toBe(path.join("custom", "data", DB_FILENAME));
  });

  test("falls back to backend/data when CUSTOM_DATA_DIR is unset", () => {
    delete process.env.CUSTOM_DATA_DIR;
    const result = defaultDbPath();
    expect(result.endsWith(path.join("data", DB_FILENAME))).toBe(true);
  });
});

/** Thin wrapper around DuckDBInstance.create; mocks let us inspect the args. */
describe("openConnection", () => {
  beforeEach(() => {
    DuckDBInstance.create.mockClear();
  });

  test("opens the explicit dbPath when provided", async () => {
    await openConnection("/tmp/explicit.duckdb");
    expect(DuckDBInstance.create).toHaveBeenCalledWith("/tmp/explicit.duckdb");
  });

  // Drives the default-parameter branch (`dbPath = defaultDbPath()`); without
  // this test the branch goes uncovered because every other caller passes
  // an explicit path.
  test("falls back to defaultDbPath when called with no arguments", async () => {
    await openConnection();
    expect(DuckDBInstance.create).toHaveBeenCalledTimes(1);
    const arg = DuckDBInstance.create.mock.calls[0][0];
    expect(arg.endsWith(DB_FILENAME)).toBe(true);
  });
});
