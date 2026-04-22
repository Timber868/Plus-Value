# Plus-Value — Backend

The Express API backend for **Plus-Value**, a Ligue 1 club finance and transfer intelligence web app.

Built with Node.js and Express 5.

## Getting Started

### Prerequisites

- Node.js

### Install Dependencies

```bash
cd backend
npm install
```

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

## Market dataset (Transfermarkt DuckDB)

`src/jobs/marketDataset.js` downloads the public Transfermarkt DuckDB snapshot into `data/` (default file: `data/market-datasets.duckdb`). Default source project: [transfermarkt-datasets](https://github.com/dcaribou/transfermarkt-datasets) on GitHub. Run the job from this folder with `node src/jobs/marketDataset.js`. Override `CUSTOM_DATA_URL` or `CUSTOM_DATA_DIR` if needed.

To inspect the file, install the **DuckDB CLI** from [Installation](https://duckdb.org/docs/installation/). More documentation: [DuckDB docs](https://duckdb.org/docs/). On Windows, put the app under **Program Files**, add that folder to your **PATH**, then open a terminal in `data/` and run `duckdb market-datasets.duckdb`.

Example query (finds clubs with “lyon” in the name):

```sql
SELECT * FROM clubs WHERE name ILIKE '%lyon%';
```

## Project Structure

## Database (ER Diagram)

<p align="center">
  <img src="../docs/er-diagram.jpg" alt="Database ER diagram" width="40%" />
</p>
