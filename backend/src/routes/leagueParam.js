/**
 * Reads the optional ?league=<competitionId> query parameter (e.g. "FR1").
 *
 * @param {*} value raw query value
 * @returns {string | null | undefined} the id, null when absent, undefined when invalid
 */
function parseLeague(value) {
  if (value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^[A-Za-z0-9]{1,10}$/.test(value)) return undefined;
  return value;
}

module.exports = { parseLeague };
