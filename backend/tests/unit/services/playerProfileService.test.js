/**
 * @file Unit tests for the player profile service with mocked models. The
 * real queries run against an in-memory MongoDB in playerProfileService.db.test.js.
 */

jest.mock("../../../src/models/Player", () => ({ findById: jest.fn() }));
jest.mock("../../../src/models/Transfer", () => ({ findOne: jest.fn() }));
jest.mock("../../../src/models/MarketValue", () => ({ findOne: jest.fn() }));

const Player = require("../../../src/models/Player");
const Transfer = require("../../../src/models/Transfer");
const MarketValue = require("../../../src/models/MarketValue");
const { getPlayerProfile } = require("../../../src/services/playerProfileService");

/** A chainable query mock (sort, populate) that resolves to `result` on lean(). */
function query(result) {
  const chain = {
    sort: jest.fn(() => chain),
    populate: jest.fn(() => chain),
    lean: jest.fn().mockResolvedValue(result),
  };
  return chain;
}

const person = { name: "Alexandre Lacazette", birthDate: new Date("1991-05-28"), nationality: "France" };

describe("getPlayerProfile", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("returns null when the player does not exist", async () => {
    Player.findById.mockReturnValue(query(null));

    expect(await getPlayerProfile("507f1f77bcf86cd799439011")).toBeNull();
    expect(Transfer.findOne).not.toHaveBeenCalled();
  });

  it("returns the profile with the current club and market values", async () => {
    Player.findById.mockReturnValue(query({ _id: "p1", person }));
    Transfer.findOne.mockReturnValue(query({ buyer: { _id: "c1", name: "Olympique Lyonnais" } }));
    const latest = query({ value: 5000000, date: new Date("2024-06-01") });
    const peak = query({ value: 60000000, date: new Date("2018-01-01") });
    MarketValue.findOne.mockReturnValueOnce(latest).mockReturnValueOnce(peak);

    const profile = await getPlayerProfile("p1");

    expect(profile).toEqual({
      id: "p1",
      name: "Alexandre Lacazette",
      birthDate: new Date("1991-05-28"),
      nationality: "France",
      currentClub: { id: "c1", name: "Olympique Lyonnais" },
      latestMarketValue: { value: 5000000, date: new Date("2024-06-01") },
      peakMarketValue: { value: 60000000, date: new Date("2018-01-01") },
    });
    expect(latest.sort).toHaveBeenCalledWith({ date: -1 });
    expect(peak.sort).toHaveBeenCalledWith({ value: -1, date: -1 });
  });

  it("returns nulls when the player has no transfers or market values", async () => {
    Player.findById.mockReturnValue(query({ _id: "p1", person }));
    Transfer.findOne.mockReturnValue(query(null));
    MarketValue.findOne.mockReturnValue(query(null));

    const profile = await getPlayerProfile("p1");

    expect(profile.currentClub).toBeNull();
    expect(profile.latestMarketValue).toBeNull();
    expect(profile.peakMarketValue).toBeNull();
  });
});
