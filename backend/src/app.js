const express = require("express");
const apiRoutes = require("./routes");
const { notFound, errorHandler } = require("./middleware/errorHandlers");

// App setup: no database connection or listen here, so tests can import it
const app = express();

// Middleware
app.use(express.json());

// API Routes
app.use("/api", apiRoutes);
app.use("/api", notFound);

app.use(errorHandler);

module.exports = app;
