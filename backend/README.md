# Plus-Value — Backend

The Express API backend for **Plus-Value**, a Ligue 1 club finance and transfer intelligence web app.

Built with Node.js and Express 5.

## Getting Started

### Prerequisites

- Node.js 18+ (required for the built-in `fetch` API)

### Install Dependencies

```bash
cd backend
npm install
```

### Environment Variables

Create a `.env` file in the `backend/` directory:

```bash
cp .env.example .env
```

Then fill in the required values:

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | **Yes** | MongoDB Atlas connection string (e.g. `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<db>`) |
| `CUSTOM_DATA_URL` | No | Override the default Transfermarkt DuckDB download URL |
| `CUSTOM_DATA_DIR` | No | Override the default `data/` directory for the DuckDB snapshot |

### Development Server

```bash
npm run dev
```

Runs with nodemon, so the server restarts automatically on file changes.

For production:

```bash
npm start
```

The server runs on `http://localhost:3000` by default (check `src/server.js` for the exact port).

## Jobs

### Download Market Dataset

**Script:** `src/jobs/marketDataset.js`

Downloads the public [transfermarkt-datasets](https://github.com/dcaribou/transfermarkt-datasets) DuckDB snapshot into `data/market-datasets.duckdb`.

```bash
node src/jobs/marketDataset.js
```

You can override the download URL or output directory with the `CUSTOM_DATA_URL` and `CUSTOM_DATA_DIR` env vars (see table above).

#### Inspecting the DuckDB file

1. Install the [DuckDB CLI](https://duckdb.org/docs/installation/).
   - On Windows: put the executable under **Program Files** and add that folder to your **PATH**.
2. Open a terminal in the `data/` directory and run:

```bash
duckdb market-datasets.duckdb
```

3. Try a query:

```sql
SELECT * FROM clubs WHERE name ILIKE '%lyon%';
```

Full documentation: [DuckDB docs](https://duckdb.org/docs/).

### Sync Leagues to MongoDB

**Script:** `src/jobs/mongo/leagueSync.js`

Reads the `competitions` table from the local DuckDB snapshot and upserts rows into the MongoDB `leagues` collection. Existing documents are matched on `competitionId`; the sync updates `name`, `confederation`, `competitionFormat`, and `tier` (when derivable), and `country` when the source has one, while **not** overwriting `europeanSpots` so manual values in MongoDB are preserved.

**Prerequisites:** `MONGODB_URI` in `.env`, and the DuckDB snapshot present (see [Download Market Dataset](#download-market-dataset) above). Rows that are missing any required field (`competitionId`, `name`, or `confederation` after mapping from DuckDB) are skipped and counted in the summary; they are not written to MongoDB. `country` is optional (many international competitions have no host country in the source data).

**Default run (summary only):**

```bash
node src/jobs/mongo/leagueSync.js
```

Prints a single line of counts, for example: how many competition rows were read, how many were skipped, how many were synced, and MongoDB `upserted` / `modified` counts from the bulk write.

**Verbose (per skipped row):** Use this when you want to see *which* competitions were skipped and *which* fields were empty.

- **Flags:** `node src/jobs/mongo/leagueSync.js --verbose` or `-v`
- **Environment:** set `LEAGUE_SYNC_VERBOSE=1` (or `true` / `yes`) in `.env` so every run of the script is verbose without passing a flag

With verbose on, the script still prints the same summary line, then a short list: each skipped row shows a stable id/name when available and the list of required fields that were missing (mapped to the League schema: `competitionId`, `name`, `confederation`).

## Project Structure

## Database (ER Diagram)

<p align="center">
  <img src="../docs/er-diagram.jpg" alt="Database ER diagram" width="40%" />
</p>
