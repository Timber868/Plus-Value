jest.mock("../../../src/services/clubTransferRoiService", () => ({ getClubTransferRoi: jest.fn() }));
jest.mock("../../../src/services/selectorService", () => ({ listClubs: jest.fn() }));
jest.mock("../../../src/services/squadValueService", () => ({ getSquadValue: jest.fn() }));

const request = require("supertest");
const app = require("../../../src/app");
const { getClubTransferRoi } = require("../../../src/services/clubTransferRoiService");
const { listClubs } = require("../../../src/services/selectorService");
const { getSquadValue } = require("../../../src/services/squadValueService");

const CLUB_ID = "507f1f77bcf86cd799439011";
const SEASON_ID = "507f1f77bcf86cd799439012";

describe("GET /api/clubs/:id/transfers/roi", () => {
  beforeEach(() => {
    getClubTransferRoi.mockReset();
  });

  it("returns the club's transfers and totals", async () => {
    const roi = { transfers: [], totals: { totalSpent: 0, totalCurrentValue: 0, totalResaleIncome: 0, netGain: 0 } };
    getClubTransferRoi.mockResolvedValue(roi);

    const res = await request(app).get(`/api/clubs/${CLUB_ID}/transfers/roi`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(roi);
    expect(getClubTransferRoi).toHaveBeenCalledWith(CLUB_ID, { seasonId: null });
  });

  it("passes the season filter", async () => {
    getClubTransferRoi.mockResolvedValue({ transfers: [], totals: {} });

    const res = await request(app).get(`/api/clubs/${CLUB_ID}/transfers/roi`).query({ season: SEASON_ID });

    expect(res.status).toBe(200);
    expect(getClubTransferRoi).toHaveBeenCalledWith(CLUB_ID, { seasonId: SEASON_ID });
  });

  it("returns 400 for an invalid club id", async () => {
    const res = await request(app).get("/api/clubs/nope/transfers/roi");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid club id" });
    expect(getClubTransferRoi).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid season", async () => {
    const res = await request(app).get(`/api/clubs/${CLUB_ID}/transfers/roi`).query({ season: "nope" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid season" });
    expect(getClubTransferRoi).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown club", async () => {
    getClubTransferRoi.mockResolvedValue(null);

    const res = await request(app).get(`/api/clubs/${CLUB_ID}/transfers/roi`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Club not found" });
  });
});

describe("GET /api/clubs", () => {
  beforeEach(() => {
    listClubs.mockReset();
  });

  it("returns the clubs without a league filter", async () => {
    const clubs = [{ id: CLUB_ID, name: "Olympique Lyonnais", country: "France" }];
    listClubs.mockResolvedValue(clubs);

    const res = await request(app).get("/api/clubs");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ clubs });
    expect(listClubs).toHaveBeenCalledWith({ league: null });
  });

  it("passes the league filter", async () => {
    listClubs.mockResolvedValue([]);

    const res = await request(app).get("/api/clubs").query({ league: "FR1" });

    expect(res.status).toBe(200);
    expect(listClubs).toHaveBeenCalledWith({ league: "FR1" });
  });

  it("returns 400 for an invalid league", async () => {
    const res = await request(app).get("/api/clubs?league=FR1&league=GB1");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid league" });
    expect(listClubs).not.toHaveBeenCalled();
  });
});

describe("GET /api/clubs/:id/seasons/:seasonId/squad-value", () => {
  beforeEach(() => {
    getSquadValue.mockReset();
  });

  it("returns the squad value", async () => {
    const squad = {
      club: { id: CLUB_ID, name: "Olympique Lyonnais" },
      season: { id: SEASON_ID, period: "2025/2026" },
      referenceDate: "2025-12-18T00:00:00.000Z",
      players: [],
      totals: { totalValue: 0, playerCount: 0, valuedPlayerCount: 0, byPosition: [] },
    };
    getSquadValue.mockResolvedValue(squad);

    const res = await request(app).get(`/api/clubs/${CLUB_ID}/seasons/${SEASON_ID}/squad-value`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(squad);
    expect(getSquadValue).toHaveBeenCalledWith(CLUB_ID, SEASON_ID);
  });

  it("returns 404 when the club or the season does not exist", async () => {
    getSquadValue.mockResolvedValue(null);

    const res = await request(app).get(`/api/clubs/${CLUB_ID}/seasons/${SEASON_ID}/squad-value`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Club or season not found" });
  });

  it("returns 400 for an invalid club or season id", async () => {
    const badClub = await request(app).get(`/api/clubs/nope/seasons/${SEASON_ID}/squad-value`);
    const badSeason = await request(app).get(`/api/clubs/${CLUB_ID}/seasons/nope/squad-value`);

    expect(badClub.status).toBe(400);
    expect(badSeason.status).toBe(400);
    expect(badSeason.body).toEqual({ error: "Invalid season id" });
    expect(getSquadValue).not.toHaveBeenCalled();
  });
});
