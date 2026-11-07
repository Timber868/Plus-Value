const request = require("supertest");
const app = require("../../../src/app");

describe("app", () => {
  it("GET /api/health reports ok and a disconnected database when not connected", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", database: "disconnected" });
  });

  it("GET /players still answers from the player router", async () => {
    const res = await request(app).get("/players");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "players" });
  });
});
