const hicpTable = require("../../data/seeds/hicp-euro-area.json");

/**
 * Inflation adjustment (ECS-164): expresses an amount from one year in the
 * money of a reference year, amount * index(referenceYear) / index(year).
 *
 * An index is { name, valueFor(year) }. The default is euro area consumer
 * inflation (HICP, data/seeds/hicp-euro-area.json). Another index, such as a
 * transfer market index computed from our own valuations, only needs the same
 * shape. Years outside the table use its first or last year.
 */

/**
 * Builds an index from a { name, values: { "2020": 105.11, ... } } table.
 *
 * @param {{ name: string, values: Record<string, number> }} table
 */
function createIndex(table) {
  const years = Object.keys(table.values)
    .map(Number)
    .sort((a, b) => a - b);
  const first = years[0];
  const last = years[years.length - 1];
  return {
    name: table.name,
    firstYear: first,
    lastYear: last,
    valueFor(year) {
      const clamped = Math.min(Math.max(year, first), last);
      return table.values[String(clamped)];
    },
  };
}

const HICP = createIndex(hicpTable);

/**
 * Default inflation settings: HICP, in money of the index's latest year.
 */
function defaultInflation() {
  return { index: HICP, referenceYear: HICP.lastYear };
}

/**
 * The amount in constant euros of the reference year, rounded to the euro.
 * Null stays null.
 *
 * @param {number | null} amount
 * @param {Date | string | null} date when the amount was paid or valued
 * @param {{ index: { valueFor(year: number): number }, referenceYear: number }} inflation
 */
function adjustAmount(amount, date, { index, referenceYear }) {
  if (amount === null || amount === undefined) return null;
  if (!date) return amount;
  const year = new Date(date).getUTCFullYear();
  return Math.round((amount * index.valueFor(referenceYear)) / index.valueFor(year));
}

/**
 * Gain and ROI in constant euros: cost and return each adjusted from their
 * own date, so a fee paid long ago weighs more.
 *
 * @param {object} args
 * @param {number | null} args.cost amount paid
 * @param {Date | null} args.costDate
 * @param {number | null} args.value amount received or held
 * @param {Date | null} args.valueDate
 * @param {object} inflation see defaultInflation
 * @returns {{ cost: number | null, value: number | null, gain: number | null, roiPercent: number | null }}
 */
function adjustGain({ cost, costDate, value, valueDate }, inflation) {
  const adjustedCost = adjustAmount(cost, costDate, inflation);
  const adjustedValue = adjustAmount(value, valueDate, inflation);
  const gain = adjustedCost !== null && adjustedValue !== null ? adjustedValue - adjustedCost : null;
  const roiPercent = gain !== null && adjustedCost > 0 ? Math.round((gain / adjustedCost) * 1000) / 10 : null;
  return { cost: adjustedCost, value: adjustedValue, gain, roiPercent };
}

/**
 * Describes the settings for an API response.
 *
 * @param {object} inflation see defaultInflation
 */
function describeInflation({ index, referenceYear }) {
  return { index: index.name, referenceYear };
}

module.exports = { HICP, createIndex, defaultInflation, adjustAmount, adjustGain, describeInflation };
