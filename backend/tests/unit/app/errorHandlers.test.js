const express = require("express");
const mongoose = require("mongoose");
const request = require("supertest");
const { notFound, errorHandler } = require("../../../src/middleware/errorHandlers");

// Small app that throws chosen errors, to exercise the handlers in isolation
function buildApp(throwError) {
  const app = express();
  app.get("/api/boom", () => {
    throw throwError();
  });
  app.use("/api", notFound);
  app.use(errorHandler);
  return app;
}

describe("errorHandlers", () => {
  it("maps an invalid ObjectId cast error to a JSON 400", async () => {
    const castError = () => {
      try {
        mongoose.Types.ObjectId.createFromHexString("not-an-id");
      } catch (reason) {
        return new mongoose.Error.CastError("ObjectId", "not-an-id", "_id", reason);
      }
      return new Error("unreachable");
    };

    const res = await request(buildApp(castError)).get("/api/boom");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid _id" });
  });

  it("maps an unexpected error to a JSON 500 without leaking the message", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});

    const res = await request(buildApp(() => new Error("secret detail"))).get("/api/boom");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("keeps the status of client errors that carry one", async () => {
    const clientError = () => Object.assign(new Error("Payload too large"), { status: 413, expose: true });

    const res = await request(buildApp(clientError)).get("/api/boom");

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: "Payload too large" });
  });
});
