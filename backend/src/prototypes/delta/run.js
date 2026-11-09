/**
 * Runs one delta prototype and prints what it found as JSON. Nothing is
 * written to the database.
 *
 *   node src/prototypes/delta/run.js wikipedia --windows "summer 2026,winter 2026–27"
 *   API_FOOTBALL_KEY=... node src/prototypes/delta/run.js api-football --since 2026-06-30 --leagues 61,62 --season 2026
 *   node src/prototypes/delta/run.js amf --since 2026-06-01
 *
 * Add --out file.json to save the result instead of printing it.
 */
const fs = require("fs");

const wikipedia = require("./wikipedia");
const apiFootball = require("./apiFootball");
const amf = require("./amfReleases");

function parseArgs(argv) {
  const [source, ...rest] = argv;
  const options = {};
  for (let i = 0; i < rest.length; i += 2) options[rest[i].replace(/^--/, "")] = rest[i + 1];
  return { source, options };
}

async function run(source, options) {
  const since = options.since || "2026-06-30";
  switch (source) {
    case "wikipedia":
      return wikipedia.collect({ windows: (options.windows || "summer 2026").split(",").map((w) => w.trim()) });
    case "api-football":
      return apiFootball.collect({
        apiKey: process.env.API_FOOTBALL_KEY,
        leagueIds: (options.leagues || "61").split(",").map(Number),
        season: Number(options.season || 2026),
        since,
      });
    case "amf":
      return amf.collect({ since, until: options.until, maxFiles: options.max ? Number(options.max) : undefined });
    default:
      throw new Error("Choose a source: wikipedia, api-football or amf");
  }
}

async function main() {
  const { source, options } = parseArgs(process.argv.slice(2));
  const records = await run(source, options);
  const json = JSON.stringify({ source, count: records.length, records }, null, 2);
  if (options.out) {
    await fs.promises.writeFile(options.out, json);
    console.log(`${records.length} records written to ${options.out}`);
  } else {
    console.log(json);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { parseArgs, run };
