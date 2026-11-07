const request = require("supertest");
const app = require("../../../src/app");

describe("app", () => {
  it("GET /api/health reports ok and a disconnected database when not connected", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", database: "disconnected" });
  });

  it("returns a JSON 404 for unknown /api paths", async () => {
    const res = await request(app).get("/api/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });

  it("no longer serves the placeholder /players routes", async () => {
    const res = await request(app).get("/players");

    expect(res.status).toBe(404);
  });

  it("returns a JSON 400 for a malformed JSON body", async () => {
    const res = await request(app)
      .post("/api/health")
      .set("Content-Type", "application/json")
      .send("{not json");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: expect.any(String) });
  });
});
