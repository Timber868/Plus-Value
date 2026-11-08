jest.mock("../../../src/services/playerSearchService", () => {
  const actual = jest.requireActual("../../../src/services/playerSearchService");
  return { ...actual, searchPlayers: jest.fn() };
});

jest.mock("../../../src/services/playerProfileService", () => ({ getPlayerProfile: jest.fn() }));

jest.mock("../../../src/services/playerMarketValueService", () => {
  const actual = jest.requireActual("../../../src/services/playerMarketValueService");
  return { ...actual, getMarketValueSeries: jest.fn() };
});

jest.mock("../../../src/services/playerTransferService", () => ({ getPlayerTransfers: jest.fn() }));
jest.mock("../../../src/services/playerTransferRoiService", () => ({ getPlayerTransferRoi: jest.fn() }));

const request = require("supertest");
const app = require("../../../src/app");
const { searchPlayers } = require("../../../src/services/playerSearchService");
const { getPlayerProfile } = require("../../../src/services/playerProfileService");
const { getMarketValueSeries } = require("../../../src/services/playerMarketValueService");
const { getPlayerTransfers } = require("../../../src/services/playerTransferService");
const { getPlayerTransferRoi } = require("../../../src/services/playerTransferRoiService");

describe("GET /api/players", () => {
  beforeEach(() => {
    searchPlayers.mockReset();
  });

  it("returns the search results", async () => {
    searchPlayers.mockResolvedValue([{ id: "p1", name: "Alexandre Lacazette" }]);

    const res = await request(app).get("/api/players").query({ q: "laca", limit: "5" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ results: [{ id: "p1", name: "Alexandre Lacazette" }] });
    expect(searchPlayers).toHaveBeenCalledWith({ query: "laca", clubId: null, limit: 5 });
  });

  it("returns 400 when the query is too short", async () => {
    const res = await request(app).get("/api/players").query({ q: "l" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("q");
    expect(searchPlayers).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid club id", async () => {
    const res = await request(app).get("/api/players").query({ q: "laca", club: "nope" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid club" });
  });

  it("returns a JSON 500 when the search fails", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    searchPlayers.mockRejectedValue(new Error("db down"));

    const res = await request(app).get("/api/players").query({ q: "laca" });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
    spy.mockRestore();
  });
});

describe("GET /api/players/:id", () => {
  const id = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    getPlayerProfile.mockReset();
  });

  it("returns the player profile", async () => {
    getPlayerProfile.mockResolvedValue({ id, name: "Alexandre Lacazette" });

    const res = await request(app).get(`/api/players/${id}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id, name: "Alexandre Lacazette" });
    expect(getPlayerProfile).toHaveBeenCalledWith(id);
  });

  it("returns 404 when the player does not exist", async () => {
    getPlayerProfile.mockResolvedValue(null);

    const res = await request(app).get(`/api/players/${id}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Player not found" });
  });

  it("returns 400 for an invalid id", async () => {
    const res = await request(app).get("/api/players/not-an-id");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid player id" });
    expect(getPlayerProfile).not.toHaveBeenCalled();
  });
});

describe("GET /api/players/:id/market-values", () => {
  const id = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    getMarketValueSeries.mockReset();
  });

  it("returns the market value series", async () => {
    getMarketValueSeries.mockResolvedValue([{ date: new Date("2024-01-01"), value: 1000 }]);

    const res = await request(app).get(`/api/players/${id}/market-values`).query({ from: "2020-01-01" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ marketValues: [{ date: "2024-01-01T00:00:00.000Z", value: 1000 }] });
    expect(getMarketValueSeries).toHaveBeenCalledWith(id, { from: new Date("2020-01-01"), to: null });
  });

  it("returns 404 when the player does not exist", async () => {
    getMarketValueSeries.mockResolvedValue(null);

    const res = await request(app).get(`/api/players/${id}/market-values`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Player not found" });
  });

  it("returns 400 for an invalid id or date", async () => {
    const badId = await request(app).get("/api/players/nope/market-values");
    const badDate = await request(app).get(`/api/players/${id}/market-values`).query({ to: "soon" });

    expect(badId.status).toBe(400);
    expect(badDate.status).toBe(400);
    expect(badDate.body.error).toContain("to");
    expect(getMarketValueSeries).not.toHaveBeenCalled();
  });
});

describe("GET /api/players/:id/transfers", () => {
  const id = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    getPlayerTransfers.mockReset();
  });

  it("returns the player's transfers", async () => {
    getPlayerTransfers.mockResolvedValue([
      { date: new Date("2017-07-05"), fromClub: { id: "c1", name: "OL" }, toClub: { id: "c2", name: "Arsenal" }, fee: 53000000 },
    ]);

    const res = await request(app).get(`/api/players/${id}/transfers`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      transfers: [
        { date: "2017-07-05T00:00:00.000Z", fromClub: { id: "c1", name: "OL" }, toClub: { id: "c2", name: "Arsenal" }, fee: 53000000 },
      ],
    });
    expect(getPlayerTransfers).toHaveBeenCalledWith(id);
  });

  it("returns 404 when the player does not exist", async () => {
    getPlayerTransfers.mockResolvedValue(null);

    const res = await request(app).get(`/api/players/${id}/transfers`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Player not found" });
  });

  it("returns 400 for an invalid id", async () => {
    const res = await request(app).get("/api/players/nope/transfers");

    expect(res.status).toBe(400);
    expect(getPlayerTransfers).not.toHaveBeenCalled();
  });
});

describe("GET /api/players/:id/transfers/roi", () => {
  const id = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    getPlayerTransferRoi.mockReset();
  });

  it("returns the player's transfers with their ROI", async () => {
    getPlayerTransferRoi.mockResolvedValue([
      {
        date: new Date("2017-07-05"),
        fromClub: { id: "c1", name: "OL" },
        toClub: { id: "c2", name: "Arsenal" },
        feePaid: 53000000,
        marketValueAtSigning: null,
        exit: { type: "resale", value: 0, date: new Date("2022-07-01") },
        gain: -53000000,
        roiPercent: -100,
      },
    ]);

    const res = await request(app).get(`/api/players/${id}/transfers/roi`);

    expect(res.status).toBe(200);
    expect(res.body.transfers).toHaveLength(1);
    expect(res.body.transfers[0]).toMatchObject({ feePaid: 53000000, roiPercent: -100, exit: { type: "resale" } });
    expect(getPlayerTransferRoi).toHaveBeenCalledWith(id);
  });

  it("returns 404 when the player does not exist", async () => {
    getPlayerTransferRoi.mockResolvedValue(null);

    const res = await request(app).get(`/api/players/${id}/transfers/roi`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Player not found" });
  });

  it("returns 400 for an invalid id", async () => {
    const res = await request(app).get("/api/players/nope/transfers/roi");

    expect(res.status).toBe(400);
    expect(getPlayerTransferRoi).not.toHaveBeenCalled();
  });
});
