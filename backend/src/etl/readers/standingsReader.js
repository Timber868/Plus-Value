const { openConnection } = require("../duckdb/client");

/**
 * Escapes a single-quoted SQL string literal by doubling embedded quotes.
 *
 * `season` and `competitionId` come from internal job config (not user input),
 * but escaping keeps the inline query robust against an apostrophe ever
 * sneaking into a competition code.
 *
 * @param {string|number} value
 * @returns {string}
 */
function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Reads per-club standings for a single season of one competition from the
 * local DuckDB snapshot. Mirrors `etl/duckdb/queries/club_season_points.sql`
 * (which stays as the manual-run reference) but is parameterised and shaped
 * for the Club / ClubSeason mappers.
 *
 * Points are derived from goals (win=3, draw=1, loss=0); `club_games.is_win`
 * is intentionally ignored because it cannot distinguish a draw from a loss.
 * Aggregates are cast to INTEGER so the node-api returns plain JS numbers
 * rather than BigInt, and `clubId` is taken from the VARCHAR `clubs.club_id`
 * to match `Club.clubId`.
 *
 * @param {object} params
 * @param {string|number} params.season Season start year, e.g. "2025".
 * @param {string} params.competitionId Competition code, e.g. "FR1".
 * @param {string} [params.dbPath] Path to a `.duckdb` file (defaults to the
 *   production snapshot).
 * @returns {Promise<Array<{
 *   clubId: string,
 *   name: string,
 *   played: number,
 *   won: number,
 *   drawn: number,
 *   lost: number,
 *   goalsFor: number,
 *   goalsAgainst: number,
 *   goalDiff: number,
 *   points: number
 * }>>} Rows ordered by points DESC, goal diff DESC.
 */
async function readStandings({ season, competitionId, dbPath }) {
  const { instance, connection } = await openConnection(dbPath);
  try {
    const reader = await connection.runAndReadAll(
      `SELECT
         c.club_id                                              AS "clubId",
         c.name                                                 AS "name",
         count(*)::INTEGER                                      AS "played",
         sum((cg.own_goals > cg.opponent_goals)::int)::INTEGER  AS "won",
         sum((cg.own_goals = cg.opponent_goals)::int)::INTEGER  AS "drawn",
         sum((cg.own_goals < cg.opponent_goals)::int)::INTEGER  AS "lost",
         sum(cg.own_goals)::INTEGER                             AS "goalsFor",
         sum(cg.opponent_goals)::INTEGER                        AS "goalsAgainst",
         (sum(cg.own_goals) - sum(cg.opponent_goals))::INTEGER  AS "goalDiff",
         sum(CASE WHEN cg.own_goals > cg.opponent_goals THEN 3
                  WHEN cg.own_goals = cg.opponent_goals THEN 1
                  ELSE 0 END)::INTEGER                          AS "points"
       FROM club_games cg
       JOIN games  g ON cg.game_id = g.game_id
       JOIN clubs  c ON c.club_id  = CAST(cg.club_id AS VARCHAR)
       WHERE g.season         = ${sqlString(season)}
         AND g.competition_id = ${sqlString(competitionId)}
       GROUP BY c.club_id, c.name
       ORDER BY "points" DESC, "goalDiff" DESC`,
    );
    return reader.getRowObjects();
  } finally {
    // Release file handles eagerly: on Windows the OS holds an exclusive lock
    // on the .duckdb file until both the connection and the instance close.
    connection.closeSync();
    instance.closeSync();
  }
}

module.exports = { readStandings, sqlString };
