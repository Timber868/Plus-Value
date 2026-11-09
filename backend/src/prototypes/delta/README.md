# Delta prototypes: transfers and values since the last refresh

The transfermarkt-datasets snapshot stops around June 2026. These prototypes look
for what happened **after** it, from sources other than Transfermarkt (its terms
forbid scraping). They only print JSON; nothing is written to the database yet.

| Source | What it gives | Cost and terms | Coverage |
|---|---|---|---|
| **Wikipedia** "List of French football transfers …" (`wikipedia.js`) | Who moved, from and to which club, loans and releases. No fee, no date. | Free. CC BY-SA 4.0: credit Wikipedia, share derived data alike. MediaWiki API with a clear User-Agent. | Ligue 1, Ligue 2 |
| **API-Football** `/transfers` (`apiFootball.js`) | Date, both clubs, fee as text ("€ 12M", "Loan", "Free"). | Free plan 100 requests a day (key in `API_FOOTBALL_KEY`); paid plans for more. Commercial use allowed by plan. | Ligue 1 (61), Ligue 2 (62), National (63) |
| **AMF open data**, Eagle Football Group releases (`amfReleases.js`) | Lyon's sales with the official fee, add-ons and sell-on percentage. | Free, Licence Ouverte (DILA). | Lyon only |
| Sportmonks `transfers/between` (not prototyped) | Dated transfers with type ids (loan, transfer, free, end of loan) and an amount when known. | From €29/month (5 leagues), 14-day trial. | Ligue 1, Ligue 2, maybe National |

**Market values have no free, allowed source.** The options are:
- a licence for SciSports' Estimated Transfer Value, which footballtransfers.com shows, is updated monthly and is available as a JSON API by contact;
- a licence for the CIES Football Observatory's valuation platform.

FotMob and SofaScore forbid automated use in their terms, so they are out.

## Run

```sh
cd backend
node src/prototypes/delta/run.js wikipedia --windows "summer 2026,winter 2026–27" --out wiki.json
API_FOOTBALL_KEY=... node src/prototypes/delta/run.js api-football --since 2026-06-30 --leagues 61,62 --season 2026 --out apif.json
node src/prototypes/delta/run.js amf --since 2026-06-01 --max 300 --out amf.json   # needs pdftotext (poppler-utils)
```

You can also run them from GitHub: **Actions → Delta prototypes → Run workflow**. The JSON files are attached to the run as an artifact. The API-Football step only runs when the `API_FOOTBALL_KEY` secret exists.

Every record has the same shape: source, sourceUrl, playerName, sourcePlayerId, date, fromClub, toClub, isLoan, fee, feeText, addOns, sellOnPercent (see `common.js`).

## Known gaps before this becomes a job

- **Wikipedia's wikitext format is not verified yet.** The parser handles `{{Fs player|…|name=|other=(from X)}}` and plain wikitable rows, but it was built from the rendered page. Check it against the first real run.
- **The AMF folders hold every listed French company's releases.** The prototype reads at most `--max` PDFs a run. A proper job should read the feed's metadata (the issuer's name) first and download only Eagle Football Group's releases.
- **Club and player names must be matched to our database.** Wikipedia and API-Football use their own names ("Lyon", "Reims"). A matcher on normalised names plus a manual alias table is the next step, and Wikidata can link Wikipedia players to Transfermarkt ids (property P2446).
- **Combining the sources.** API-Football or Sportmonks gives the date and fee, Wikipedia confirms the move, and the AMF releases give Lyon's add-ons and sell-on clauses (ECS-175).
