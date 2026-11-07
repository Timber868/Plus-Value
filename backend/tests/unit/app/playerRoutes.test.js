jest.mock("../../../src/services/playerSearchService", () => {
  const actual = jest.requireActual("../../../src/services/playerSearchService");
  return { ...actual, searchPlayers: jest.fn() };
});

jest.mock("../../../src/services/playerProfileService", () => ({ getPlayerProfile: jest.fn() }));

const request = require("supertest");
const app = require("../../../src/app");
const { searchPlayers } = require("../../../src/services/playerSearchService");
const { getPlayerProfile } = require("../../../src/services/playerProfileService");

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
