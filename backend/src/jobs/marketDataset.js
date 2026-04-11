const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");
const { Readable } = require("stream");

// Default URL where the data download sits
const DEFAULT_URL =
  "https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/transfermarkt-datasets.duckdb";

// If a custom url is set in the env use it. This is useful for future pipelines.
const DATA_URL = process.env.CUSTOM_DATA_URL || DEFAULT_URL;

// Repo-root backend/data this makes it more flexible for future changes.
const OUT_DIR =
  process.env.CUSTOM_DATA_DIR || path.join(__dirname, "..", "..", "data");

const FILENAME = "market-datasets.duckdb";

// Helper function to make the request and get the data
async function downloadDataset() {
  // Make the directory if it does not already exist and prepare filepath
  await fs.promises.mkdir(OUT_DIR, { recursive: true });
  const destPath = path.join(OUT_DIR, FILENAME);

  // Make the request to retrieve the data
  const res = await fetch(DATA_URL);

  // Verify output
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  }

  // Save the data
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(destPath));

  return destPath;
}

async function main() {
  const path = await downloadDataset();
  console.log(`Dataset successfully saved at: ${path}`);
}

//If this file is run then execute the mainfunction
if (require.main == module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { downloadDataset };
