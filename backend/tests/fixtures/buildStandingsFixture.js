const fs = require("fs");
const os = require("os");
const path = require("path");
const { DuckDBInstance } = require("@duckdb/node-api");

/**
 * @file Builds a tiny DuckDB file mirroring the shape of the production
 * `games`, `club_games`, and `clubs` tables that the standings reader joins.
 * Used by the standings reader unit test and the syncSeasons integration test
 * so they never touch real data.
 *
 * The fixture encodes a deterministic 3-club mini-league for FR1 / season
 * 2025, plus two distractor games (a different season and a different
 * competition) that must be excluded by the reader's WHERE clause.
 */

/** Clubs keyed by the VARCHAR club_id used in the `clubs` table. */
const CLUBS = [
  { club_id: "1", name: "Club A" },
  { club_id: "2", name: "Club B" },
  { club_id: "3", name: "Club C" },
];

/** Games: four count toward FR1/2025, two are distractors. */
const GAMES = [
  { game_id: "g1", season: "2025", competition_id: "FR1" },
  { game_id: "g2", season: "2025", competition_id: "FR1" },
  { game_id: "g3", season: "2025", competition_id: "FR1" },
  { game_id: "g4", season: "2025", competition_id: "FR1" },
  // Distractors: same clubs but a different season / competition.
  { game_id: "g5", season: "2024", competition_id: "FR1" },
  { game_id: "g6", season: "2025", competition_id: "GB1" },
];

/**
 * One row per club per game (own_goals / opponent_goals are from that club's
 * perspective). `is_win` is included to mirror the real schema even though the
 * points query deliberately ignores it (it cannot tell a draw from a loss).
 */
const CLUB_GAMES = [
  // g1: A 2-0 B
  { game_id: "g1", club_id: 1, own_goals: 2, opponent_goals: 0, is_win: 1 },
  { game_id: "g1", club_id: 2, own_goals: 0, opponent_goals: 2, is_win: 0 },
  // g2: A 1-0 C
  { game_id: "g2", club_id: 1, own_goals: 1, opponent_goals: 0, is_win: 1 },
  { game_id: "g2", club_id: 3, own_goals: 0, opponent_goals: 1, is_win: 0 },
  // g3: B 3-1 C
  { game_id: "g3", club_id: 2, own_goals: 3, opponent_goals: 1, is_win: 1 },
  { game_id: "g3", club_id: 3, own_goals: 1, opponent_goals: 3, is_win: 0 },
  // g4: A 1-1 B (draw)
  { game_id: "g4", club_id: 1, own_goals: 1, opponent_goals: 1, is_win: 0 },
  { game_id: "g4", club_id: 2, own_goals: 1, opponent_goals: 1, is_win: 0 },
  // g5: A 5-0 B but in season 2024 (excluded)
  { game_id: "g5", club_id: 1, own_goals: 5, opponent_goals: 0, is_win: 1 },
  { game_id: "g5", club_id: 2, own_goals: 0, opponent_goals: 5, is_win: 0 },
  // g6: A 9-0 B but in GB1 (excluded)
  { game_id: "g6", club_id: 1, own_goals: 9, opponent_goals: 0, is_win: 1 },
  { game_id: "g6", club_id: 2, own_goals: 0, opponent_goals: 9, is_win: 0 },
];

/**
 * Expected standings for FR1 / season 2025, in the order the reader returns
 * them (points DESC, goal_diff DESC). Lets tests assert the whole table at
 * once.
 */
const EXPECTED_STANDINGS = [
  {
    clubId: "1",
    name: "Club A",
    played: 3,
    won: 2,
    drawn: 1,
    lost: 0,
    goalsFor: 4,
    goalsAgainst: 1,
    goalDiff: 3,
    points: 7,
  },
  {
    clubId: "2",
    name: "Club B",
    played: 3,
    won: 1,
    drawn: 1,
    lost: 1,
    goalsFor: 4,
    goalsAgainst: 4,
    goalDiff: 0,
    points: 4,
  },
  {
    clubId: "3",
    name: "Club C",
    played: 2,
    won: 0,
    drawn: 0,
    lost: 2,
    goalsFor: 1,
    goalsAgainst: 4,
    goalDiff: -3,
    points: 0,
  },
];

/**
 * Quotes a scalar for inline interpolation into a DuckDB statement. Inline
 * interpolation is safe here because every input is hard-coded in this file.
 *
 * @param {string|number|null|undefined} value
 * @returns {string}
 */
function quote(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Creates a `.duckdb` file at `targetPath` containing the `clubs`, `games`,
 * and `club_games` tables populated with the fixture rows above. Overwrites
 * any existing file at that location.
 *
 * @param {string} targetPath
 * @returns {Promise<string>} Echoes back `targetPath`.
 */
async function buildFixture(targetPath) {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { force: true });
  }

  const instance = await DuckDBInstance.create(targetPath);
  const connection = await instance.connect();

  await connection.run(`
    CREATE TABLE clubs (
      club_id VARCHAR,
      name VARCHAR
    );
  `);
  await connection.run(`
    CREATE TABLE games (
      game_id VARCHAR,
      season VARCHAR,
      competition_id VARCHAR
    );
  `);
  await connection.run(`
    CREATE TABLE club_games (
      game_id VARCHAR,
      club_id INTEGER,
      own_goals INTEGER,
      opponent_goals INTEGER,
      is_win INTEGER
    );
  `);

  for (const c of CLUBS) {
    await connection.run(
      `INSERT INTO clubs VALUES (${quote(c.club_id)}, ${quote(c.name)});`,
    );
  }
  for (const g of GAMES) {
    await connection.run(
      `INSERT INTO games VALUES (${quote(g.game_id)}, ${quote(g.season)}, ${quote(g.competition_id)});`,
    );
  }
  for (const cg of CLUB_GAMES) {
    await connection.run(
      `INSERT INTO club_games VALUES (${quote(cg.game_id)}, ${quote(cg.club_id)}, ${quote(cg.own_goals)}, ${quote(cg.opponent_goals)}, ${quote(cg.is_win)});`,
    );
  }

  connection.closeSync?.();
  instance.closeSync?.();

  return targetPath;
}

/**
 * Allocates a fresh temp directory and returns a unique path for a fixture
 * file, so parallel tests do not lock each other out.
 *
 * @param {string} label Short identifier embedded in the temp directory name.
 * @returns {string} Absolute path to a `standings.duckdb` location.
 */
function freshFixturePath(label) {
  const dir = fs.mkdtempSync(
    path.join(os.tmpdir(), `plusvalue-standings-${label}-`),
  );
  return path.join(dir, "standings.duckdb");
}

module.exports = {
  CLUBS,
  GAMES,
  CLUB_GAMES,
  EXPECTED_STANDINGS,
  buildFixture,
  freshFixturePath,
};
