// utils/helpers.js — Shared utility functions
// TODO: add helpers as the project grows

/**
 * Converts a monetary amount from one currency to EUR.
 * @param {number} amount
 * @param {string} fromCurrency
 * @returns {number}
 */
exports.toEur = (amount, fromCurrency = 'EUR') => {
  // TODO: use a live exchange rate API or static rates
  return amount;
};

/**
 * Calculates transfer ROI percentage.
 * ROI = (currentValue − purchaseFee) / purchaseFee × 100
 * @param {number} purchaseFee
 * @param {number} currentValue
 * @returns {number|null}
 */
exports.calculateROI = (purchaseFee, currentValue) => {
  if (!purchaseFee || purchaseFee === 0) return null;
  return ((currentValue - purchaseFee) / purchaseFee) * 100;
};

/**
 * Formats a number as a Euro currency string.
 * @param {number} amount
 * @returns {string}
 */
exports.formatCurrency = (amount) => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
};
