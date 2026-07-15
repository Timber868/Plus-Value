/**
 * @file Unit tests for the syncOwners orchestration. The owner service is
 * mocked so we only verify the wiring (seed file reading, row shaping, skip
 * counting, stats). The pure mapper runs for real against a temp seed file.
 * The full I/O path lives in tests/integration/syncOwners.int.test.js.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

jest.mock("../../../src/services/ownerService", () => ({
  upsertMany: jest.fn(),
}));

const ownerService = require("../../../src/services/ownerService");
const { run } = require("../../../src/jobs/syncOwners");

function makeEntry(overrides = {}) {
  return {
    name: "Nasser Al-Khelaïfi",
    birthDate: "1973-11-12",
    nationality: "Qatar",
    netWorth: 8000000000,
    financialSustainabilityScore: 90,
    ...overrides,
  };
}

/** Writes entries to a fresh temp owners.json and returns its path. */
function writeSeed(entries) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "plusvalue-owners-"));
  const seedPath = path.join(dir, "owners.json");
  fs.writeFileSync(seedPath, JSON.stringify(entries));
  return seedPath;
}

beforeEach(() => {
  jest.clearAllMocks();
  ownerService.upsertMany.mockResolvedValue({ synced: 0 });
});

describe("syncOwners.run", () => {
  test("falls back to the committed seed file when no path is given", async () => {
    await run();
    expect(ownerService.upsertMany).toHaveBeenCalled();
  });

  test("throws a clear error when the seed file does not exist", async () => {
    const missing = path.join(os.tmpdir(), "no-such-dir", "owners.json");
    await expect(run({ seedPath: missing })).rejects.toThrow(
      /seed file not found/i,
    );
    expect(ownerService.upsertMany).not.toHaveBeenCalled();
  });

  test("maps seed entries through toOwnerDoc before upserting", async () => {
    const seedPath = writeSeed([makeEntry()]);

    await run({ seedPath });

    expect(ownerService.upsertMany).toHaveBeenCalledWith([
      {
        name: "Nasser Al-Khelaïfi",
        birthDate: new Date("1973-11-12T00:00:00.000Z"),
        nationality: "Qatar",
        netWorth: 8000000000,
        financialSustainabilityScore: 90,
      },
    ]);
  });

  test("skips invalid entries and counts them", async () => {
    const seedPath = writeSeed([
      makeEntry(),
      makeEntry({ name: "" }),
      makeEntry({ name: "Bad Score", financialSustainabilityScore: 400 }),
    ]);

    const stats = await run({ seedPath });

    expect(stats.inspected).toBe(3);
    expect(stats.skipped).toBe(2);
    expect(ownerService.upsertMany.mock.calls[0][0]).toHaveLength(1);
  });

  test("returns aggregated stats", async () => {
    const seedPath = writeSeed([makeEntry(), makeEntry({ name: "Other" })]);
    ownerService.upsertMany.mockResolvedValue({ synced: 2 });

    const stats = await run({ seedPath });

    expect(stats).toEqual({
      inspected: 2,
      skipped: 0,
      ownersSynced: 2,
    });
  });
});
