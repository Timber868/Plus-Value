jest.mock("../../../src/services/selectorService", () => ({ listSeasons: jest.fn() }));

const request = require("supertest");
const app = require("../../../src/app");
const { listSeasons } = require("../../../src/services/selectorService");

describe("GET /api/seasons", () => {
  beforeEach(() => {
    listSeasons.mockReset();
  });

  it("returns the seasons without a league filter", async () => {
    const seasons = [{ id: "s1", period: "2024/2025", startDate: "2024-08-01T00:00:00.000Z", endDate: "2025-05-31T00:00:00.000Z", league: "FR1" }];
    listSeasons.mockResolvedValue(seasons);

    const res = await request(app).get("/api/seasons");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ seasons });
    expect(listSeasons).toHaveBeenCalledWith({ league: null });
  });

  it("passes the league filter", async () => {
    listSeasons.mockResolvedValue([]);

    const res = await request(app).get("/api/seasons").query({ league: "FR1" });

    expect(res.status).toBe(200);
    expect(listSeasons).toHaveBeenCalledWith({ league: "FR1" });
  });

  it("returns 400 for an invalid league", async () => {
    const res = await request(app).get("/api/seasons").query({ league: "FR 1" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid league" });
    expect(listSeasons).not.toHaveBeenCalled();
  });
});
