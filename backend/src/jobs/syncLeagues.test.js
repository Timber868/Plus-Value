/**
 * @file Unit tests for the syncLeagues orchestration. Reader and service are
 * mocked so we only verify the wiring (dbPath forwarding, skip counting,
 * default-arg branch). End-to-end behaviour lives in the integration test.
 */

jest.mock("../etl/readers/competitionsReader", () => ({
  readCompetitions: jest.fn(),
}));
jest.mock("../services/leagueService", () => ({
  upsertMany: jest.fn(),
}));

const { readCompetitions } = require("../etl/readers/competitionsReader");
const leagueService = require("../services/leagueService");
const { run } = require("./syncLeagues");

beforeEach(() => {
  readCompetitions.mockReset();
  leagueService.upsertMany.mockReset();
});

describe("syncLeagues.run", () => {
  // Exercises the happy path: a valid row is forwarded to the service and an
  // invalid one (null confederation) is counted under `skipped` instead.
  test("forwards dbPath to the reader and returns aggregated stats", async () => {
    // Mock rows match the post-SQL shape that `readCompetitions` now returns
    // (camelCase keys, `competitionFormat` already classified).
    readCompetitions.mockResolvedValueOnce([
      {
        competitionId: "FR1",
        name: "Ligue 1",
        country: "France",
        confederation: "UEFA",
        sub_type: ["first_tier"],
        competitionFormat: "league",
      },
      {
        competitionId: "BAD",
        name: "Bad",
        country: "Nowhere",
        confederation: null,
        sub_type: [],
        competitionFormat: "league",
      },
    ]);
    leagueService.upsertMany.mockResolvedValueOnce({ upserted: 1, modified: 0 });

    const stats = await run({ dbPath: "/tmp/x.duckdb" });

    expect(readCompetitions).toHaveBeenCalledWith("/tmp/x.duckdb");
    expect(leagueService.upsertMany).toHaveBeenCalledTimes(1);
    // Only the valid doc should make it to the service.
    expect(leagueService.upsertMany.mock.calls[0][0]).toHaveLength(1);
    expect(stats).toEqual({
      inspected: 2,
      skipped: 1,
      synced: 1,
      upserted: 1,
      modified: 0,
    });
  });

  // Covers the `{ dbPath } = {}` default-argument branch. Without an args-less
  // call here, that destructure default goes uncovered.
  test("uses no dbPath when called with no arguments (default parameter)", async () => {
    readCompetitions.mockResolvedValueOnce([]);
    leagueService.upsertMany.mockResolvedValueOnce({ upserted: 0, modified: 0 });

    const stats = await run();

    expect(readCompetitions).toHaveBeenCalledWith(undefined);
    expect(stats).toEqual({
      inspected: 0,
      skipped: 0,
      synced: 0,
      upserted: 0,
      modified: 0,
    });
  });
});
