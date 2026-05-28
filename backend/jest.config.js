module.exports = {
  testEnvironment: "node",

  // Look for both co-located unit tests under src/ and integration tests under tests/
  testMatch: ["**/src/**/*.test.js", "**/tests/**/*.test.js"],

  // Only the modules we are actively splitting out get coverage thresholds enforced.
  // Mongoose schemas, server bootstrap, and route plumbing are trivial config code
  // and are excluded so they don't dilute the metric.
  collectCoverageFrom: [
    "src/etl/**/*.js",
    "src/services/**/*.js",
    "src/jobs/**/*.js",
    "!src/jobs/marketDataset.js",
    "!**/*.test.js",
  ],

  coverageThreshold: {
    global: {
      lines: 80,
      branches: 100,
      functions: 80,
      statements: 80,
    },
  },

  coverageReporters: ["text", "text-summary", "lcov"],

  // Integration tests can be slow (memory mongo + duckdb); give them headroom.
  testTimeout: 30000,
};
