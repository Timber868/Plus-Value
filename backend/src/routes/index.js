// routes/index.js — Aggregates all API routers under /api/v1
// TODO: add auth routes when authentication is implemented

const express = require('express');
const router = express.Router();

const playerRoutes   = require('./playerRoutes');
const clubRoutes     = require('./clubRoutes');
const transferRoutes = require('./transferRoutes');

router.use('/players',   playerRoutes);
router.use('/clubs',     clubRoutes);
router.use('/transfers', transferRoutes);
// TODO: router.use('/auth', authRoutes);
// TODO: router.use('/market-values', marketValueRoutes);

module.exports = router;
