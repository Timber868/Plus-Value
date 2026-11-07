jest.mock("../../../src/services/playerSearchService", () => {
  const actual = jest.requireActual("../../../src/services/playerSearchService");
  return { ...actual, searchPlayers: jest.fn() };
});

const request = require("supertest");
const app = require("../../../src/app");
const { searchPlayers } = require("../../../src/services/playerSearchService");

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
