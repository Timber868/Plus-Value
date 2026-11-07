const mongoose = require("mongoose");

// JSON 404 for any /api path no router handled
function notFound(req, res) {
  res.status(404).json({ error: "Not found" });
}

// Turns errors into JSON responses. Invalid ObjectIds and bad request bodies
// are client errors (400); anything else is a 500 without internal details.
// Express needs all four arguments to treat this as an error handler.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: `Invalid ${err.path}` });
  }
  if (err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: err.expose ? err.message : "Bad request" });
  }
  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
}

module.exports = { notFound, errorHandler };
