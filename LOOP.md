# Plus-Value Phase 1 loop

This file is maintained by the scheduled build loop. Linear (project "Plus-Value Phase 1", team ECSE Games) is the source of truth for tasks; the checklist below mirrors it.

## Checklist

- [x] ECS-137 Infra: Add GitHub Actions CI workflow
- [x] ECS-138 Infra: Get existing lint and unit tests passing in CI
- [x] ECS-139 Infra: Split Express app from server startup so routes are testable
- [x] ECS-140 Infra: Mount API routes under /api with JSON 404 and error handler
- [x] ECS-141 Infra: Frontend French locale and HTTP client setup
- [x] ECS-142 Infra: Frontend app shell with French navigation for the three dashboards
- [x] ECS-143 Infra: Add a chart library and a shared line chart component
- [x] ECS-144 KF-1: Player search endpoint GET /api/players
- [x] ECS-145 KF-1: Player profile endpoint GET /api/players/:id
- [x] ECS-146 KF-1: Market value time series endpoint GET /api/players/:id/market-values
- [x] ECS-147 KF-1: Player search page in Angular
- [x] ECS-148 KF-1: Player market value page with chart
- [x] ECS-149 KF-1: Show transfers as markers on the market value chart
- [x] ECS-150 KF-2: Transfer ROI calculation service
- [x] ECS-151 KF-2: Club transfer ROI endpoint GET /api/clubs/:id/transfers/roi
- [x] ECS-152 KF-2: Player transfer ROI endpoint GET /api/players/:id/transfers/roi
- [ ] ECS-153 KF-2: Club and season list endpoints for selectors
- [ ] ECS-154 KF-2: Club transfer ROI dashboard page
- [ ] ECS-155 KF-2: Player transfer ROI section on the player page
- [ ] ECS-156 KF-3: Squad value service for a club and season
- [ ] ECS-157 KF-3: Squad value endpoint GET /api/clubs/:id/seasons/:seasonId/squad-value
- [ ] ECS-158 KF-3: Squad value evolution endpoint across seasons
- [ ] ECS-159 KF-3: Squad value overview page
- [ ] ECS-160 Infra: Fixture seed script for local demo data
- [ ] ECS-161 Infra: Document the Phase 1 API endpoints
- [ ] ECS-162 KF-1: Store player position from the dataset
- [x] ECS-163 KF-1: Treat market values older than the last market window as unknown

## Decisions and assumptions

- Linear has a single team (ECSE Games), so the "Plus-Value Phase 1" project lives there.
- Task order follows Linear priority (Urgent, High, Medium, Low), then the order above.
- CI uses Node 22 (same as the loop sandbox) and caches the mongodb-memory-server binary in ~/.cache/mongodb-binaries.
- The loop sandbox cannot download the MongoDB binary (fastdl.mongodb.org returns 403 through the proxy), so the 5 tests in tests/unit/models/Club.test.js and all integration tests can only be verified in CI. Everything else (257 backend unit tests, frontend lint and build) passes locally.
- Tim does not want GitHub Actions billing. The first CI runs were refused over account billing, so Tim made the repo public, where Actions is free. After that the re-run went green on PR #2, including the mongodb-memory-server Club model tests, so ECS-138 needed no code change. If CI is ever refused for billing again, switch the workflow to workflow_dispatch only and rely on local checks instead of enabling paid minutes.

- ECS-139 keeps the /players mount and port 3000 unchanged; moving routes under /api is left to ECS-140. supertest was added as a dev dependency for route tests.
- backend/package-lock.json had 95 duplicated package entries (a merge artifact). npm removed them when supertest was added; `npm ci`, lint and tests pass with the cleaned lockfile.

- ECS-140 removed the placeholder /players router; real player routes arrive with ECS-144 under /api/players. Error responses use the shape { "error": "<message>" }. Malformed JSON bodies and other client errors keep their 4xx status; 500s never expose the internal message.
- The run lock branch cannot be deleted through the sandbox proxy, so runs release it by pushing a backdated "loop unlock" commit and take it by pushing a fast-forward "loop lock" commit on top.
- ECS-141: HttpClient, ApiService (/api/health) and the dev proxy (/api to localhost:3000) were already correct, so the change only registers the fr-FR locale, sets LOCALE_ID fr-FR and DEFAULT_CURRENCY_CODE EUR, and sets index.html lang="fr". Frontend unit tests (Karma) run locally with the Playwright Chromium via CHROME_BIN and the ChromeHeadlessNoSandbox launcher.
- Tim wants URL paths and endpoints in English like the rest of the code; only visible UI copy is French. ECS-142 routes are /players, /transfer-roi and /squad-value; the home page and unknown paths redirect to /players. The Angular starter page was replaced by the shell, and the health check now shows a French sentence in the footer.
- PRs #4 and #5 were merged; the scheduled self-chaining (fire_trigger) is denied by a permission check, so runs continue on the regular schedule or when Tim asks.
- ECS-143 uses Chart.js 4 directly (no Angular wrapper library) in a standalone shared component, app-line-chart, registering only the line chart pieces. It uses a category x-axis, so callers pass already formatted labels (for example dates). Values format as euros or plain numbers in the app locale.
- ECS-144: the Player model has no position, so GET /api/players returns id, name, nationality, current club and latest market value, and storing position became ECS-162. The current club is the buyer of the player's latest transfer. Accent-insensitive search widens each letter of the query into its accented variants in a regex, so no extra normalized-name field is needed. q needs at least 2 characters; the limit defaults to 20 and is capped at 50; club filters by the club's Mongo id. Player ids in the API are Mongo ids.
- MongoDB-backed tests (Club model, player search aggregation) can only run in CI, because the sandbox cannot download the MongoDB binary and downloading it from other mirrors was refused by a permission check.
- ECS-145: GET /api/players/:id returns id, name, birth date, nationality, current club (buyer of the latest transfer), latest and peak market value. Position waits on ECS-162. On equal peak values the most recent one wins. Invalid ids return 400, unknown ids 404.
- ECS-146: GET /api/players/:id/market-values returns { marketValues: [{ date, value }] } oldest first. from and to are inclusive and accept 2024-06-01 or full ISO timestamps; from after to is a 400. Unknown players get a 404, and a known player with no values gets an empty list.
- ECS-147: the search page debounces input by 300 ms, needs 2 characters, and uses switchMap so a slower older answer never replaces a newer one. Results link to /players/:id, which ECS-148 will add (until then that URL falls back to /players).
- Market values come from the latest player_valuations row of the transfermarkt-datasets snapshot, which matches the players table value (checked by Tim on Lacazette and Drogba). They can lag Transfermarkt's site when the local snapshot is old, and stop when a player leaves the tracked leagues or retires, so the UI always shows the valuation date next to the value.
- ECS-163 (Tim's rule): a player's latest market value is current only if it is no older than one market window (6 months) before the newest valuation in the database; otherwise the API returns null (shown as "Valeur inconnue"). The cutoff follows the dataset, not today's date, so an old snapshot still shows values. The peak value and the time series keep the full history. MarketValue gained a { date: -1 } index for finding the newest valuation.
- ECS-148: the player page at /players/:id loads the profile and the history together (forkJoin), treats 404 and 400 as "Joueur introuvable", and reloads when the id changes. The chart uses a category x-axis, so points are evenly spaced rather than proportional to time; a time axis would need the chartjs date adapter.
- ECS-149: GET /api/players/:id/transfers returns { transfers: [{ date, fromClub, toClub, fee }] } oldest first; fromClub is null without a seller and fee is null when the dataset has none (free or undisclosed), while 0 stays 0. On the chart, each transfer sits on the valuation closest in time (the x-axis has one label per valuation) and takes that value; transfers before the first or after the last valuation are left out, and transfers on the same valuation share one marker. A failed transfers request only hides the markers. The shared line chart gained optional marker-only series (showLine false, triangles) and per-point tooltip text.
- ECS-150: transfer ROI rules live in backend/src/services/transferRoi.js as pure functions. Fee paid is the transfer fee (null when unknown, 0 stays 0). Market value at signing is the closest valuation on or before the transfer date. The exit value is the fee of the player's next transfer (any next move ends his stay at the buying club, so a loan move counts too), or, when he has not moved since, his latest valuation if it still counts as current under the ECS-163 rule (otherwise null). Gain is exit value minus fee paid; ROI is gain over fee paid in percent, rounded to one decimal, and null when the fee paid is 0 or anything needed is unknown. Tim should check whether loans should be excluded once real data is loaded.
- ECS-151: GET /api/clubs/:id/transfers/roi returns { transfers, totals } with the club's incoming transfers oldest first, each with player, date, seller (fromClub) and the ECS-150 ROI fields. The optional season query takes a Season Mongo id. Totals skip unknown amounts: totalSpent sums known fees, totalCurrentValue sums current valuations of players still at the club, totalResaleIncome sums known resale fees, and netGain sums only the gains that are known, so it can differ from income minus spending.
- ECS-152: GET /api/players/:id/transfers/roi returns { transfers } oldest first, each with date, fromClub, toClub and the ECS-150 ROI fields from the buying club's point of view. The exit of each transfer is the player's next transfer; the latest one uses his current valuation. No totals are returned for a player.

## Blocked / needs Tim

- Nothing right now.

## Run log

- 2026-11-07 19:01 UTC: ECS-137 CI workflow added (.github/workflows/ci.yml); Linear project and 25 issues created. PR #2.
- 2026-11-07 20:29 UTC: ECS-138 CI green on PR #2 after the billing block was cleared (re-run, no code change). PR #2.
- 2026-11-07 20:53 UTC: ECS-139 split Express app (src/app.js) from startup (src/server.js), added supertest and app tests. 259 unit tests pass locally (Club model tests CI-only). PR #3.
- 2026-11-07 21:10 UTC: ECS-140 /api router with JSON 404, 400 for invalid ObjectIds and bad bodies, JSON 500 handler; placeholder /players removed. 264 unit tests pass locally (Club model tests CI-only). PR #4.
- 2026-11-07 21:12 UTC: ECS-141 French locale (fr-FR, EUR) in app config with pipe formatting tests; frontend lint, build and 7 Karma tests pass. PR #5.
- 2026-11-07 21:18 UTC: ECS-142 app shell with French header, navigation and lazy-loaded placeholder pages for the three dashboards; frontend lint, build and 9 Karma tests pass. PR #6.
- 2026-11-07 21:45 UTC: ECS-143 added Chart.js and the shared app-line-chart component with French euro formatting; frontend lint, build and 16 Karma tests pass. PR #7.
- 2026-11-07 21:56 UTC: ECS-144 GET /api/players search (accent insensitive, club filter, limit) with unit and route tests passing locally; the MongoDB aggregation test runs in CI. PR #8.
- 2026-11-07 22:04 UTC: ECS-145 GET /api/players/:id profile with mocked unit and route tests passing locally; the MongoDB test runs in CI. PR #9.
- 2026-11-07 22:25 UTC: ECS-146 GET /api/players/:id/market-values with from/to filters; mocked unit and route tests pass locally, the MongoDB test runs in CI. PR #10.
- 2026-11-07 22:34 UTC: ECS-147 player search page with debounced search, result list and French empty, loading and error states; frontend lint, build and 22 Karma tests pass, screenshot checked with a mocked API. PR #11.
- 2026-11-07 22:42 UTC: ECS-163 null market value for players not revalued in the last market window (search and profile); 309 non-MongoDB backend tests pass locally, MongoDB tests run in CI. PR #12.
- 2026-11-07 22:46 UTC: ECS-148 player page with profile header, current and peak value cards and the market value chart; frontend lint, build and 29 Karma tests pass, screenshot checked with a mocked API. PR #13.
- 2026-11-08 00:55 UTC: ECS-149 GET /api/players/:id/transfers and transfer markers with French tooltips on the market value chart; 315 non-MongoDB backend tests and 37 Karma tests pass, lint and build pass, screenshot checked with a mocked API. PR #14.
- 2026-11-08 01:05 UTC: ECS-150 pure transfer ROI functions (value at signing, exit value by resale or current valuation, gain, ROI percent) with 13 unit tests; 328 non-MongoDB backend tests and lint pass. PR #15.
- 2026-11-08 04:54 UTC: ECS-151 GET /api/clubs/:id/transfers/roi with season filter and club totals; 343 non-MongoDB backend tests and lint pass, the MongoDB test runs in CI. PR #16.
- 2026-11-08 05:00 UTC: ECS-152 GET /api/players/:id/transfers/roi with mocked service and route tests; 344 non-MongoDB backend tests and lint pass. PR #17.
