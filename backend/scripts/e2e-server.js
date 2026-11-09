/**
 * @file Server for the end-to-end tests (e2e/). Starts an in-memory MongoDB,
 * loads the demo data set (src/jobs/demo/demoData.js), and serves the API
 * and the built Angular app from one port, like production.
 *
 * Never touches a real database: it always uses its own in-memory MongoDB.
 *
 * Environment:
 * - E2E_PORT: port to listen on (default 4400)
 * - FRONTEND_DIST: built frontend folder (default ../frontend/dist/frontend/browser)
 */
const path = require("path");
const fs = require("fs");
const express = require("express");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

// No external crest images in the tests: the app shows club initials instead
process.env.CLUB_LOGO_URL_TEMPLATE = "";

const app = require("../src/app");
const { seed } = require("../src/jobs/seedDemo");

const PORT = Number(process.env.E2E_PORT || 4400);
const DIST = path.resolve(process.env.FRONTEND_DIST || path.join(__dirname, "..", "..", "frontend", "dist", "frontend", "browser"));

async function main() {
  if (!fs.existsSync(path.join(DIST, "index.html"))) {
    throw new Error(`No built frontend in ${DIST}. Run "npx ng build" in frontend/ first.`);
  }
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: "plusvalue-e2e" });
  const counts = await seed();
  console.log("Demo data loaded:", counts);

  const server = express();
  server.use(app);
  server.use(express.static(DIST));
  // Client-side routes (e.g. /transfer-roi) get the app shell
  server.use((req, res) => res.sendFile(path.join(DIST, "index.html")));

  const http = server.listen(PORT, () => console.log(`E2E server on http://127.0.0.1:${PORT}`));
  const stop = async () => {
    http.close();
    await mongoose.disconnect();
    await mongo.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
