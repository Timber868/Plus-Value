jest.mock("../../../src/services/clubTransferRoiService", () => ({ getClubTransferRoi: jest.fn() }));

const request = require("supertest");
const app = require("../../../src/app");
const { getClubTransferRoi } = require("../../../src/services/clubTransferRoiService");

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
