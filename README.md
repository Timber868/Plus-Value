# Plus-Value

Transfer intelligence and player value tracking for Ligue 1 clubs. Track market value trends, evaluate transfer ROI, and analyze squad finances.

## Tech Stack

- **Frontend:** Angular 19, TypeScript, SCSS
- **Backend:** Node.js, Express 5
- **Database:** MongoDB

## Getting Started

### Prerequisites

- Node.js
- MongoDB
- Angular CLI: `npm install -g @angular/cli`

### Setup

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (in a separate terminal)
cd frontend
npm install
ng serve
```

The frontend runs on `http://localhost:4200` and proxies API requests to the backend.

### Demo data

To try the dashboard without running the ETL, load a small Olympique Lyonnais demo data set into a local MongoDB:

```bash
cd backend
MONGODB_URI=mongodb://127.0.0.1:27017 npm run seed:demo
```

The figures are rounded examples, not real data. The script can be run again safely, only touches the demo players and clubs, and refuses a remote (`mongodb+srv://`) database unless `SEED_ALLOW_REMOTE=1` is set.

## Project Structure
