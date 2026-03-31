// middleware/errorHandler.js — Centralised Express error handler
// TODO: handle Mongoose validation errors, cast errors, duplicates, JWT errors

/**
 * Express error-handling middleware (4-argument signature required).
 */
const errorHandler = (err, req, res, next) => {
  console.error('[error]', err);

  // TODO: map specific error types to HTTP status codes:
  //   - mongoose.Error.ValidationError  → 400
  //   - mongoose.Error.CastError        → 400 (invalid ObjectId)
  //   - code 11000 (duplicate key)      → 409
  //   - JsonWebTokenError               → 401

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    // stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};

module.exports = errorHandler;
