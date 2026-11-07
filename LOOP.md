# Plus-Value Phase 1 loop

This file is maintained by the scheduled build loop. Linear (project "Plus-Value Phase 1", team ECSE Games) is the source of truth for tasks; the checklist below mirrors it.

## Checklist

- [x] ECS-137 Infra: Add GitHub Actions CI workflow
- [ ] ECS-138 Infra: Get existing lint and unit tests passing in CI
- [ ] ECS-139 Infra: Split Express app from server startup so routes are testable
- [ ] ECS-140 Infra: Mount API routes under /api with JSON 404 and error handler
- [ ] ECS-141 Infra: Frontend French locale and HTTP client setup
- [ ] ECS-142 Infra: Frontend app shell with French navigation for the three dashboards
- [ ] ECS-143 Infra: Add a chart library and a shared line chart component
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
- Tim does not want GitHub Actions billing. The first CI runs were refused over account billing, so Tim made the repo public, where Actions is free. If CI is ever refused for billing again, switch the workflow to workflow_dispatch only and rely on local checks instead of enabling paid minutes.

## Blocked / needs Tim

- Nothing yet.

## Run log

- 2026-11-07 19:01 UTC: ECS-137 CI workflow added (.github/workflows/ci.yml); Linear project and 25 issues created. PR #2.
