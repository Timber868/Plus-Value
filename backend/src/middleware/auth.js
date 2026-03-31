// middleware/auth.js — JWT authentication middleware
// TODO: verify Bearer token and attach user to req.user

const jwt = require('jsonwebtoken');

/**
 * Protects routes: checks for a valid JWT in the Authorization header.
 */
exports.authenticate = (req, res, next) => {
  // TODO:
  //   const token = req.headers.authorization?.split(' ')[1];
  //   if (!token) return res.status(401).json({ success: false, message: 'No token provided' });
  //   try {
  //     req.user = jwt.verify(token, process.env.JWT_SECRET);
  //     next();
  //   } catch (err) {
  //     return res.status(401).json({ success: false, message: 'Invalid token' });
  //   }
  next(); // placeholder — remove when implemented
};

/**
 * Role-based access control.
 * @param {...string} roles - allowed roles
 */
exports.authorize = (...roles) => (req, res, next) => {
  // TODO: check req.user.role against roles
  next(); // placeholder — remove when implemented
};
