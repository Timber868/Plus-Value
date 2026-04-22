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

Reads the `competitions` table from the local DuckDB snapshot and upserts the data into the MongoDB `leagues` collection. Requires `MONGODB_URI` to be set in `.env` and the DuckDB file to be downloaded first.

```bash
node src/jobs/mongo/leagueSync.js
```

## Project Structure

## Database (ER Diagram)

<p align="center">
  <img src="../docs/er-diagram.jpg" alt="Database ER diagram" width="40%" />
</p>
