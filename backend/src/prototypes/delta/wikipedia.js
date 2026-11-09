/**
 * Prototype 1: Wikipedia "List of French football transfers <window>" pages.
 *
 * Free (CC BY-SA 4.0, credit Wikipedia and share derived data alike), read
 * through the MediaWiki API. Covers Ligue 1 and Ligue 2, usually updated
 * within days. It has no fee and no date: each player is followed by the move
 * in brackets, "(from Reims)", "(on loan from Milan)", "(to Getafe)",
 * "(released)". Good for "who moved since the last refresh", then the fee
 * comes from another source.
 */
const { get, record } = require("./common");

const API = "https://en.wikipedia.org/w/api.php";

/** Page titles of the windows after a date, for example ["summer 2026", "winter 2026–27"] */
function windowPages(windows) {
  return windows.map((w) => `List of French football transfers ${w}`);
}

function wikitextUrl(title) {
  const params = new URLSearchParams({ action: "parse", page: title, prop: "wikitext", format: "json", formatversion: "2" });
  return `${API}?${params}`;
}

/** Removes wiki markup: links keep their label, templates and refs disappear */
function plain(text) {
  return text
    .replace(/<ref[^>]*\/>/g, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "")
    .replace(/\{\{(?:flagicon|fb|flag|sortname)[^}]*\}\}/gi, "")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, "$1")
    .replace(/'''?/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MOVE = /^(.*?)\s*\((on loan )?(from|to) ([^)]+?)(, previously on loan)?\)\s*$/i;
const RELEASED = /^(.*?)\s*\((released|free agent|retired|contract terminated)\)\s*$/i;

/** Club headings look like ===[[Olympique Lyonnais|Lyon]]=== */
const CLUB_HEADING = /^={3,4}\s*(.+?)\s*={3,4}\s*$/;
const LEAGUE_HEADING = /^==\s*([^=].*?)\s*==\s*$/;

/**
 * Text after the player in a line: the `name=` and `other=` of {{Fs player}},
 * or the last cell of a wikitable row.
 */
function playerCell(line) {
  const tpl = line.match(/\{\{\s*fs (?:player|in|out)\s*\|(.*)\}\}/i);
  if (tpl) {
    const params = {};
    for (const part of tpl[1].split(/\|(?![^[]*\]\])/)) {
      const eq = part.indexOf("=");
      if (eq > 0) params[part.slice(0, eq).trim().toLowerCase()] = part.slice(eq + 1).trim();
    }
    if (!params.name) return null;
    return plain(`${params.name} ${params.other || ""}`);
  }
  if (line.startsWith("|") && !line.startsWith("|-") && !line.startsWith("|}")) {
    const cells = line.replace(/^\|/, "").split("||");
    return plain(cells[cells.length - 1]);
  }
  return null;
}

/**
 * Reads the moves on one page.
 *
 * @param {string} wikitext
 * @param {string} sourceUrl
 */
function parseWikitext(wikitext, sourceUrl) {
  const records = [];
  let league = null;
  let club = null;
  const withoutRefs = wikitext.replace(/<ref[^>]*\/>/g, "").replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "");
  for (const raw of withoutRefs.split("\n")) {
    const line = raw.trim();
    const leagueHeading = line.match(LEAGUE_HEADING);
    if (leagueHeading) {
      league = plain(leagueHeading[1]);
      club = null;
      continue;
    }
    const clubHeading = line.match(CLUB_HEADING);
    if (clubHeading) {
      club = plain(clubHeading[1]);
      continue;
    }
    if (!club) continue;
    const cell = playerCell(line);
    if (!cell) continue;

    const move = cell.match(MOVE);
    if (move) {
      const [, playerName, loan, direction, other, previouslyOnLoan] = move;
      const incoming = direction.toLowerCase() === "from";
      records.push({
        ...record({
          source: "wikipedia",
          sourceUrl,
          playerName: playerName.trim(),
          fromClub: incoming ? other.trim() : club,
          toClub: incoming ? club : other.trim(),
          isLoan: !!loan,
          feeText: previouslyOnLoan ? "previously on loan" : null,
        }),
        league,
      });
      continue;
    }
    const released = cell.match(RELEASED);
    if (released) {
      records.push({
        ...record({ source: "wikipedia", sourceUrl, playerName: released[1].trim(), fromClub: club, toClub: null, fee: 0, feeText: released[2] }),
        league,
      });
    }
  }
  return records;
}

/**
 * Fetches and parses the given windows, for example ["summer 2026"].
 *
 * @param {{ windows: string[], fetchImpl?: typeof fetch }} options
 */
async function collect({ windows, fetchImpl }) {
  const all = [];
  for (const title of windowPages(windows)) {
    const url = wikitextUrl(title);
    const body = await get(url, { fetchImpl });
    if (body.error) throw new Error(`Wikipedia: ${body.error.info}`);
    const pageUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
    all.push(...parseWikitext(body.parse.wikitext, pageUrl));
  }
  return all;
}

module.exports = { windowPages, wikitextUrl, plain, parseWikitext, collect };
