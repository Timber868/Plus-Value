// utils/logger.js — Application logger
// TODO: replace console with a proper logger (e.g. winston or pino)

const logger = {
  info:  (...args) => console.log('[INFO] ',  ...args),
  warn:  (...args) => console.warn('[WARN] ',  ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  debug: (...args) => {
    if (process.env.NODE_ENV !== 'production') console.log('[DEBUG]', ...args);
  },
};

module.exports = logger;
