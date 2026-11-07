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
- [ ] ECS-144 KF-1: Player search endpoint GET /api/players
- [ ] ECS-145 KF-1: Player profile endpoint GET /api/players/:id
- [ ] ECS-146 KF-1: Market value time series endpoint GET /api/players/:id/market-values
- [ ] ECS-147 KF-1: Player search page in Angular
- [ ] ECS-148 KF-1: Player market value page with chart
- [ ] ECS-149 KF-1: Show transfers as markers on the market value chart
- [ ] ECS-150 KF-2: Transfer ROI calculation service
- [ ] ECS-151 KF-2: Club transfer ROI endpoint GET /api/clubs/:id/transfers/roi
- [ ] ECS-152 KF-2: Player transfer ROI endpoint GET /api/players/:id/transfers/roi
- [ ] ECS-153 KF-2: Club and season list endpoints for selectors
- [ ] ECS-154 KF-2: Club transfer ROI dashboard page
- [ ] ECS-155 KF-2: Player transfer ROI section on the player page
- [ ] ECS-156 KF-3: Squad value service for a club and season
- [ ] ECS-157 KF-3: Squad value endpoint GET /api/clubs/:id/seasons/:seasonId/squad-value
- [ ] ECS-158 KF-3: Squad value evolution endpoint across seasons
- [ ] ECS-159 KF-3: Squad value overview page
- [ ] ECS-160 Infra: Fixture seed script for local demo data
- [ ] ECS-161 Infra: Document the Phase 1 API endpoints

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
