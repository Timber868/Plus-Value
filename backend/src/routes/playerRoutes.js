const express = require('express');

// We create a router to handle the routes for the players
const router = express.Router();

router.get("/", (req, res) => {
    res.json({message: "players"});
});

router.get("/hi", (req, res) => {
    res.json({message: "players hi"});
});

// Expose the router to be used in the server
module.exports = router;