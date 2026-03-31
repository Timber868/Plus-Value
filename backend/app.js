// app.js — Express application setup
// TODO: wire up middleware and routes

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
// const routes = require('./src/routes');
// const errorHandler = require('./src/middleware/errorHandler');

const app = express();

// ─── Core Middleware ──────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:4200' }));
app.use(express.json());
app.use(morgan('dev'));

// ─── API Routes ───────────────────────────────────────────────────────────────
// TODO: mount versioned API router
// app.use('/api/v1', routes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ─── Error Handler ────────────────────────────────────────────────────────────
// TODO: app.use(errorHandler);

module.exports = app;
