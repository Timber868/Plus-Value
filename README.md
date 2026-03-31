# Le-Onze-Comptable

Transfer intelligence & player value tracking for Ligue 1 clubs.  
Track market value trends, evaluate transfer ROI, and analyse squad finances.

---

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Frontend  | Angular 19                          |
| Backend   | Node.js · Express.js                |
| Database  | MongoDB (Mongoose ODM)              |
| Auth      | JWT (JSON Web Tokens)               |
| Dev tools | Docker Compose · nodemon · Karma    |

---

## Project Structure

```
Le-Onze-Comptable/
├── backend/                  # Node.js + Express API
│   ├── src/
│   │   ├── config/           # DB connection & app-wide config
│   │   ├── controllers/      # Route handler functions
│   │   ├── middleware/       # Auth, error handler, validation
│   │   ├── models/           # Mongoose schemas (Player, Club, Transfer)
│   │   ├── routes/           # Express routers
│   │   ├── services/         # Business logic layer
│   │   └── utils/            # Logger, helpers
│   ├── app.js                # Express app setup
│   ├── server.js             # Server entry point
│   ├── package.json
│   └── .env.example          # Copy to .env and fill in values
│
├── frontend/                 # Angular 17 SPA
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/   # Shared UI components (Navbar, Footer)
│   │   │   ├── guards/       # Route guards (AuthGuard)
│   │   │   ├── interceptors/ # HTTP interceptors (JWT attachment)
│   │   │   ├── models/       # TypeScript interfaces
│   │   │   ├── pages/        # Page components (Dashboard, Players, Clubs, Transfers)
│   │   │   ├── services/     # Angular services (HTTP calls)
│   │   │   └── shared/       # SharedModule (common imports/exports)
│   │   ├── assets/           # Static assets (images, icons)
│   │   └── environments/     # environment.ts / environment.prod.ts
│   ├── angular.json
│   ├── proxy.conf.json       # Dev proxy → backend
│   └── package.json
│
├── docker-compose.yml        # Local dev stack (Mongo + backend + frontend)
└── README.md
```

---

## Getting Started

### Prerequisites
- Node.js >= 18
- MongoDB >= 7 (or Docker)

### Backend

```bash
cd backend
cp .env.example .env        # fill in your values
npm install
npm run dev                 # starts on http://localhost:3000
```

### Frontend

```bash
cd frontend
npm install
npm start                   # starts on http://localhost:4200
```

### With Docker Compose

```bash
docker compose up --build
```

---

## API Endpoints (planned)

| Method | Path                          | Description                    |
|--------|-------------------------------|--------------------------------|
| GET    | /api/v1/players               | List all players               |
| GET    | /api/v1/players/:id           | Get player by ID               |
| POST   | /api/v1/players               | Create player                  |
| PUT    | /api/v1/players/:id           | Update player                  |
| DELETE | /api/v1/players/:id           | Delete player                  |
| GET    | /api/v1/clubs                 | List all clubs                 |
| GET    | /api/v1/clubs/:id             | Get club by ID                 |
| GET    | /api/v1/transfers             | List all transfers             |
| GET    | /api/v1/transfers/roi/:clubId | Transfer ROI for a club        |
| GET    | /health                       | Health check                   |
