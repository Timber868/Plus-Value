// middleware/validation.js — Request body validation using express-validator
// TODO: define validation chains for each resource

const { validationResult } = require('express-validator');

/**
 * Runs after a chain of check() calls; returns 422 if any errors found.
 */
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }
  next();
};

// TODO: export named validation rule arrays, e.g.:
// exports.validatePlayer = [
//   check('name').notEmpty().trim(),
//   check('position').isIn(['GK','CB','LB','RB','CDM','CM','CAM','LW','RW','ST']),
//   check('marketValue.amount').isNumeric(),
//   exports.validate,
// ];
