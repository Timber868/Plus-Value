-- Points won by each club in a single season of one competition.
--
-- Grain: club_games already holds one row per club per game, so it is the
-- natural source for standings. Season + competition live on `games`, so we
-- join club_games.game_id -> games.game_id to scope by them.
--
-- Points are derived from goals (win=3, draw=1, loss=0). NOTE: club_games.is_win
-- is only 1/0 and cannot tell a draw from a loss, so it is unusable for points.
--
-- Run with defaults (Ligue 1, 2025):
--   duckdb -readonly backend/data/market-datasets.duckdb -f club_season_points.sql
--
-- Override for another season/league by setting the variables first, e.g.:
--   duckdb -readonly backend/data/market-datasets.duckdb \
--     -c "SET VARIABLE season='2022'; SET VARIABLE competition_id='GB1';" \
--     -f club_season_points.sql

SET VARIABLE season         = '2025';
SET VARIABLE competition_id = 'FR1';

SELECT
  cg.club_id,
  c.name AS club_name,
  count(*)                                                AS played,
  sum((cg.own_goals > cg.opponent_goals)::int)            AS won,
  sum((cg.own_goals = cg.opponent_goals)::int)            AS drawn,
  sum((cg.own_goals < cg.opponent_goals)::int)            AS lost,
  sum(cg.own_goals)                                       AS goals_for,
  sum(cg.opponent_goals)                                  AS goals_against,
  sum(cg.own_goals) - sum(cg.opponent_goals)              AS goal_diff,
  sum(CASE WHEN cg.own_goals > cg.opponent_goals THEN 3
           WHEN cg.own_goals = cg.opponent_goals THEN 1
           ELSE 0 END)                                    AS points
FROM club_games cg
JOIN games  g ON cg.game_id = g.game_id
JOIN clubs  c ON c.club_id  = CAST(cg.club_id AS VARCHAR)
WHERE g.season         = getvariable('season')
  AND g.competition_id = getvariable('competition_id')
GROUP BY cg.club_id, c.name
ORDER BY points DESC, goal_diff DESC;
