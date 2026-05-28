/**
 * @file Pure transformations applied on top of the rows returned by
 * `readCompetitions`. Field renames and the league/cup classification are
 * already handled in SQL, so this layer only owns the branchy logic that is
 * awkward to express in DuckDB:
 *   - tier extraction from a sparse, case-insensitive `sub_type` array
 *   - required-field validation (so the job can report a `skipped` count)
 */

/**
 * Extracts a numeric tier (1–5) from the DuckDB `sub_type` array.
 *
 * Returns `undefined` when no recognised tier keyword is present so the caller
 * can omit `tier` from the upsert (leaving any manual value in Mongo intact).
 *
 * @param {Array<string|null|undefined>} subType Raw `sub_type` list.
 * @returns {1|2|3|4|5|undefined}
 */
function toTier(subType) {
  const candidates = subType.filter(Boolean).map((s) => s.toLowerCase());
  for (const candidate of candidates) {
    if (candidate.includes("first_tier")) return 1;
    if (candidate.includes("second_tier")) return 2;
    if (candidate.includes("third_tier")) return 3;
    if (candidate.includes("fourth_tier")) return 4;
    if (candidate.includes("fifth_tier")) return 5;
  }
  return undefined;
}

/**
 * Adds a derived `tier` to a row from `readCompetitions` and drops the raw
 * `sub_type` array (it was only needed to compute the tier).
 *
 * @param {object} row Row from the reader; already in League schema shape
 *   apart from `sub_type` / `tier`.
 * @returns {{
 *   competitionId: string,
 *   name: string,
 *   country: string,
 *   confederation: string,
 *   competitionFormat: ("league"|"cup"),
 *   tier: (1|2|3|4|5|undefined)
 * }}
 */
function toLeagueDoc(row) {
  const { sub_type, ...doc } = row;
  return { ...doc, tier: toTier(sub_type) };
}

/**
 * Returns `true` when every field marked `required` on the League schema is
 * present and truthy. Used to skip incomplete DuckDB rows before they reach
 * the upsert layer.
 *
 * @param {object} doc Result of {@link toLeagueDoc}.
 * @returns {boolean}
 */
function isValidLeagueDoc(doc) {
  return Boolean(
    doc.competitionId && doc.name && doc.country && doc.confederation,
  );
}

module.exports = {
  toTier,
  toLeagueDoc,
  isValidLeagueDoc,
};
