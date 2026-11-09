/**
 * @file Small demo data set around Olympique Lyonnais, so the dashboard can
 * be shown on a local MongoDB without running the ETL (see seedDemo.js).
 * The figures are rounded examples for a demo, not an export of the dataset,
 * but the clubs and dates of each move follow the real transfers.
 *
 * Every entity uses the natural keys of the real models (competitionId,
 * clubId, playerId, season period), so a re-run updates instead of
 * duplicating, and transfers and valuations refer to them by those keys.
 */

const LEAGUE = {
  competitionId: "FR1",
  name: "Ligue 1",
  country: "France",
  confederation: "europa",
  tier: 1,
};

/** Season start years; each season runs from August to May */
const SEASONS = [
  { start: "2023-08-11", end: "2024-05-19" },
  { start: "2024-08-16", end: "2025-05-17" },
  { start: "2025-08-15", end: "2026-05-16" },
];

const CLUBS = [
  { clubId: "1041", name: "Olympique Lyonnais", country: "France", inLeague: true },
  { clubId: "162", name: "AS Monaco", country: "France", inLeague: true },
  { clubId: "583", name: "Paris Saint-Germain", country: "France", inLeague: true },
  { clubId: "1042", name: "Olympique Lyon B", country: "France", isExternal: true },
  { clubId: "11", name: "Arsenal FC", country: "England", isExternal: true },
  { clubId: "281", name: "Manchester City", country: "England", isExternal: true },
  { clubId: "157", name: "KAA Gent", country: "Belgium", isExternal: true },
  { clubId: "29", name: "Everton FC", country: "England", isExternal: true },
  { clubId: "703", name: "Nottingham Forest", country: "England", isExternal: true },
  { clubId: "27", name: "Bayern Munich", country: "Germany", isExternal: true },
  { clubId: "537", name: "Botafogo", country: "Brazil", isExternal: true },
  { clubId: "610", name: "Ajax Amsterdam", country: "Netherlands", isExternal: true },
];

const PLAYERS = [
  { playerId: "d1", name: "Alexandre Lacazette", birthDate: "1991-05-28", nationality: "France", position: "Attack", subPosition: "Centre-Forward" },
  { playerId: "d2", name: "Rayan Cherki", birthDate: "2003-08-17", nationality: "France", position: "Attack", subPosition: "Attacking Midfield" },
  { playerId: "d3", name: "Malick Fofana", birthDate: "2005-03-31", nationality: "Belgium", position: "Attack", subPosition: "Left Winger" },
  { playerId: "d4", name: "Corentin Tolisso", birthDate: "1994-08-03", nationality: "France", position: "Midfield", subPosition: "Central Midfield" },
  { playerId: "d5", name: "Orel Mangala", birthDate: "1998-03-18", nationality: "Belgium", position: "Midfield", subPosition: "Defensive Midfield" },
  { playerId: "d6", name: "Lucas Perri", birthDate: "1997-12-10", nationality: "Brazil", position: "Goalkeeper", subPosition: "Goalkeeper" },
  { playerId: "d7", name: "Nicolás Tagliafico", birthDate: "1992-08-31", nationality: "Argentina", position: "Defender", subPosition: "Left-Back" },
  { playerId: "d8", name: "Mahamadou Diawara", birthDate: "2005-03-02", nationality: "France", position: "Midfield", subPosition: "Central Midfield" },
];

/** fee null means unknown; season is the period the transfer is filed under */
const TRANSFERS = [
  { player: "d1", date: "2017-07-05", seller: "1041", buyer: "11", fee: 53000000, season: "2023/2024" },
  { player: "d1", date: "2022-07-01", seller: "11", buyer: "1041", fee: 0, season: "2023/2024" },
  { player: "d2", date: "2019-07-01", seller: "1042", buyer: "1041", fee: null, season: "2023/2024" },
  { player: "d2", date: "2025-07-01", seller: "1041", buyer: "281", fee: 36500000, season: "2025/2026" },
  { player: "d3", date: "2024-01-10", seller: "157", buyer: "1041", fee: 17000000, season: "2023/2024" },
  { player: "d4", date: "2022-07-01", seller: "27", buyer: "1041", fee: 0, season: "2023/2024" },
  { player: "d5", date: "2024-01-20", seller: "703", buyer: "1041", fee: 1000000, season: "2023/2024" },
  { player: "d5", date: "2024-06-30", seller: "1041", buyer: "703", fee: 0, season: "2023/2024" },
  { player: "d5", date: "2024-08-30", seller: "703", buyer: "1041", fee: 15000000, season: "2024/2025" },
  { player: "d5", date: "2025-09-01", seller: "1041", buyer: "29", fee: 2000000, season: "2025/2026" },
  { player: "d6", date: "2024-07-20", seller: "537", buyer: "1041", fee: 10000000, season: "2024/2025" },
  { player: "d7", date: "2022-07-01", seller: "610", buyer: "1041", fee: 4200000, season: "2023/2024" },
  { player: "d8", date: "2024-07-01", seller: "1042", buyer: "1041", fee: null, season: "2024/2025" },
];

const VALUATIONS = [
  ["d1", "2017-06-01", 40000000], ["d1", "2022-06-01", 15000000], ["d1", "2024-12-18", 6000000], ["d1", "2025-06-01", 3500000],
  ["d2", "2023-12-01", 25000000], ["d2", "2024-12-18", 30000000], ["d2", "2025-12-18", 40000000],
  ["d3", "2023-12-01", 9000000], ["d3", "2024-12-18", 25000000], ["d3", "2025-12-18", 35000000],
  ["d4", "2022-06-01", 10000000], ["d4", "2024-12-18", 8000000], ["d4", "2025-12-18", 6000000],
  ["d5", "2023-12-01", 20000000], ["d5", "2024-12-18", 15000000], ["d5", "2025-12-18", 5000000],
  ["d6", "2024-06-01", 8000000], ["d6", "2025-12-18", 12000000],
  ["d7", "2022-06-01", 8000000], ["d7", "2024-12-18", 4000000], ["d7", "2025-12-18", 3000000],
  ["d8", "2024-12-18", 1000000], ["d8", "2025-12-18", 2000000],
].map(([player, date, value]) => ({ player, date, value }));

module.exports = { LEAGUE, SEASONS, CLUBS, PLAYERS, TRANSFERS, VALUATIONS };
