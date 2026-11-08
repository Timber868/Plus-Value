/**
 * @file Unit tests for a player's transfer list with mocked models. The real
 * query runs against an in-memory MongoDB in playerTransferService.db.test.js.
 */

jest.mock("../../../src/models/Player", () => ({ exists: jest.fn() }));
jest.mock("../../../src/models/Transfer", () => ({ find: jest.fn() }));

const Player = require("../../../src/models/Player");
const Transfer = require("../../../src/models/Transfer");
const { getPlayerTransfers } = require("../../../src/services/playerTransferService");

describe("getPlayerTransfers", () => {
  let chain;

  beforeEach(() => {
    jest.resetAllMocks();
    chain = { sort: jest.fn(() => chain), populate: jest.fn(() => chain), lean: jest.fn() };
    Transfer.find.mockReturnValue(chain);
  });

  it("returns null when the player does not exist", async () => {
    Player.exists.mockResolvedValue(null);

    expect(await getPlayerTransfers("p1")).toBeNull();
    expect(Transfer.find).not.toHaveBeenCalled();
  });

  it("returns the transfers oldest first with clubs and fees", async () => {
    Player.exists.mockResolvedValue({ _id: "p1" });
    chain.lean.mockResolvedValue([
      {
        date: new Date("2010-07-01"),
        seller: null,
        buyer: { _id: "c1", name: "Olympique Lyonnais" },
      },
      {
        date: new Date("2017-07-05"),
        seller: { _id: "c1", name: "Olympique Lyonnais" },
        buyer: { _id: "c2", name: "Arsenal FC" },
        price: 53000000,
      },
    ]);

    const transfers = await getPlayerTransfers("p1");

    expect(Transfer.find).toHaveBeenCalledWith({ player: "p1" });
    expect(chain.sort).toHaveBeenCalledWith({ date: 1 });
    expect(chain.populate).toHaveBeenCalledWith("seller", "name");
    expect(chain.populate).toHaveBeenCalledWith("buyer", "name");
    expect(transfers).toEqual([
      {
        date: new Date("2010-07-01"),
        fromClub: null,
        toClub: { id: "c1", name: "Olympique Lyonnais" },
        fee: null,
      },
      {
        date: new Date("2017-07-05"),
        fromClub: { id: "c1", name: "Olympique Lyonnais" },
        toClub: { id: "c2", name: "Arsenal FC" },
        fee: 53000000,
      },
    ]);
  });

  it("keeps a fee of zero", async () => {
    Player.exists.mockResolvedValue({ _id: "p1" });
    chain.lean.mockResolvedValue([{ date: new Date("2022-07-01"), buyer: { _id: "c1", name: "OL" }, price: 0 }]);

    const [transfer] = await getPlayerTransfers("p1");

    expect(transfer.fee).toBe(0);
  });
});
