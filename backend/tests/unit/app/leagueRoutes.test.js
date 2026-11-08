jest.mock("../../../src/services/selectorService", () => ({ listLeagues: jest.fn() }));

const request = require("supertest");
const app = require("../../../src/app");
const { listLeagues } = require("../../../src/services/selectorService");

describe("GET /api/leagues", () => {
  it("returns the leagues", async () => {
    const leagues = [{ id: "FR1", name: "Ligue 1", country: "France", tier: 1 }];
    listLeagues.mockResolvedValue(leagues);

    const res = await request(app).get("/api/leagues");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ leagues });
  });
});
