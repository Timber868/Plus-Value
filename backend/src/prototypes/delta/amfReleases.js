/**
 * Prototype 3: Olympique Lyonnais transfer releases from the AMF open data.
 *
 * Eagle Football Group (Lyon's parent company) is listed on Euronext, so each
 * significant transfer is announced in a regulated release. DILA republishes
 * them as open data (Licence Ouverte) at
 * https://echanges.dila.gouv.fr/OPENDATA/AMF/ACT/<year>/<month>/FCACT<n>_<yyyymmdd>.pdf.
 * Only Lyon, but these give the official fee, the add-ons and the sell-on
 * percentage, which no other free source has (ECS-175).
 *
 * The prototype lists a month's PDFs, extracts their text with `pdftotext`
 * (poppler-utils), keeps the releases about a transfer and reads the amounts.
 */
const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { promisify } = require("util");

const { get, parseAmount, record } = require("./common");

const BASE = "https://echanges.dila.gouv.fr/OPENDATA/AMF/ACT";

function monthUrl(year, month) {
  return `${BASE}/${year}/${String(month).padStart(2, "0")}/`;
}

/** PDF file names and dates from a month's directory listing */
function parseListing(html, baseUrl) {
  const files = new Map();
  for (const m of html.matchAll(/href="(FCACT\d+_(\d{4})(\d{2})(\d{2})\.pdf)"/g)) {
    files.set(m[1], { url: baseUrl + m[1], date: `${m[2]}-${m[3]}-${m[4]}` });
  }
  return [...files.values()];
}

const IS_TRANSFER = /transfert|cession|prêt|s['’]engage|transfer of|loan of|joins/i;
const IS_EAGLE = /eagle football|olympique lyonnais|\bOL\b/i;

/**
 * Reads one release. Returns null when it is not about a player transfer.
 * Handles French and English wording, for example "pourrait atteindre 33,6
 * millions d'euros, dont 4,1 millions d'euros de bonus" or "could reach
 * €33.6 million, including €4.1 million in add-ons", and "10% de la plus-value".
 *
 * @param {string} text the release's text
 * @param {{ url: string, date: string }} file
 */
function parseRelease(text, file) {
  const flat = text.replace(/\s+/g, " ");
  if (!IS_EAGLE.test(flat) || !IS_TRANSFER.test(flat)) return null;

  // The title line, for example "Transfer of Afonso Moreira to Bayer 04 Leverkusen" or "Transfert de Jean Exemple au Stade Rennais"
  const TITLE = /^\s*(?:[Tt]ransfert|[Pp]rêt|[Tt]ransfer|[Ll]oan) (?:de |d['’]|of )(\p{Lu}[\p{L}'’-]*(?: \p{Lu}[\p{L}'’-]*){0,3})(?:\s+(?:to|au|aux|à l['’]|à la|à|vers le|vers)\s+(.+?))?\s*$/u;
  const titleLine = text.split("\n").map((l) => l.match(TITLE)).find(Boolean);
  if (!titleLine) return null;
  const title = [titleLine[0].trim(), titleLine[1]];
  const to = titleLine[2] ? [null, titleLine[2]] : null;
  const total = flat.match(/(?:pourrait atteindre|pouvant atteindre|could reach|up to|jusqu['’]à)\s*€?\s*([\d.,]+\s*(?:millions?|m)\b)/i);
  const fixed = flat.match(/(?:montant (?:fixe|de base)|indemnité (?:fixe|de base)|fixed (?:fee|amount)|base fee)[^\d€]{0,40}€?\s*([\d.,]+\s*(?:millions?|m)\b)/i);
  const addOns = flat.match(/(?:dont|including|plus)\s*€?\s*([\d.,]+\s*(?:millions?|m)\b)[^.]{0,40}?(?:bonus|add-ons|compléments|variables|incentives)/i);
  const sellOn = flat.match(/(\d+(?:[.,]\d+)?)\s*%[^.]{0,60}?(?:plus-value|revente|future sale|sell-on|transfert futur)/i);

  const totalAmount = total ? parseAmount(total[1]) : null;
  const addOnAmount = addOns ? parseAmount(addOns[1]) : null;
  let fee = fixed ? parseAmount(fixed[1]) : null;
  if (fee === null && totalAmount !== null) fee = addOnAmount !== null ? totalAmount - addOnAmount : totalAmount;

  return record({
    source: "amf",
    sourceUrl: file.url,
    playerName: title[1].trim(),
    date: file.date,
    fromClub: "Olympique Lyonnais",
    toClub: to ? to[1].trim() : null,
    isLoan: /\bprêt\b|\bloan\b/i.test(title[0]),
    fee,
    feeText: total ? total[0] : fixed ? fixed[0] : null,
    addOns: addOnAmount,
    sellOnPercent: sellOn ? parseFloat(sellOn[1].replace(",", ".")) : null,
  });
}

/** Text of a PDF through `pdftotext`, which GitHub's Ubuntu runners can install with apt */
async function pdfText(buffer) {
  const file = path.join(os.tmpdir(), `amf-${process.pid}-${Date.now()}.pdf`);
  await fs.promises.writeFile(file, buffer);
  try {
    const { stdout } = await promisify(execFile)("pdftotext", ["-layout", file, "-"]);
    return stdout;
  } finally {
    await fs.promises.rm(file, { force: true });
  }
}

/**
 * The ACT folders hold the releases of every listed French company, so this
 * reads at most maxFiles PDFs. A next version should read the flux's metadata
 * (issuer name) first and only download Eagle Football Group's releases.
 *
 * @param {{ since: string, until?: string, fetchImpl?: typeof fetch, extractText?: (buf: Buffer) => Promise<string>, maxFiles?: number }} options
 */
async function collect({ since, until = new Date().toISOString().slice(0, 10), fetchImpl, extractText = pdfText, maxFiles = 400 }) {
  const records = [];
  let read = 0;
  const start = new Date(`${since.slice(0, 7)}-01T00:00:00Z`);
  const end = new Date(`${until}T00:00:00Z`);
  for (let d = start; d <= end; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
    const url = monthUrl(d.getUTCFullYear(), d.getUTCMonth() + 1);
    const files = parseListing(await get(url, { fetchImpl, as: "text" }), url).filter((f) => f.date >= since && f.date <= until);
    for (const file of files) {
      if (++read > maxFiles) return records;
      const text = await extractText(await get(file.url, { fetchImpl, as: "buffer" }));
      const found = parseRelease(text, file);
      if (found) records.push(found);
    }
  }
  return records;
}

module.exports = { monthUrl, parseListing, parseRelease, collect };
