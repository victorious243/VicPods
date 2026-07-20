# Phase 0 Foundation Audit

Date: 2026-07-20

## Objective

Stabilize the current VicPods codebase enough to start Phase 1 publishing work with confidence.

Phase 0 does not add user-facing product features. It adds repeatable checks, seed data, and documentation so the next phases can be built against a known baseline.

## Added In This Phase

### Package Scripts

- npm test runs the built-in Node test suite.
- npm run test:smoke runs the Phase 0 smoke tests only.
- npm run phase0:check verifies required files, package scripts, environment configuration, upload directories, and upload gitignore safety.
- npm run seed:phase0 creates a complete demo podcast workflow in MongoDB.

### Smoke Tests

File: test/phase0.smoke.test.js

Coverage:

- Production environment validation catches missing critical settings.
- Publish URL/path helpers produce stable public podcast routes.
- RSS feed generation includes required show and episode metadata.
- Audio public URL helpers keep uploaded audio in the expected public namespace.
- Publish-critical schema indexes exist for shows, episodes, and audio assets.

### Readiness Checker

File: scripts/checkPhase0Readiness.js

Checks:

- Required project files exist.
- Required package scripts exist.
- Environment validation passes for the active NODE_ENV.
- Upload folders are either present or reported as setup warnings.
- public/uploads/ is gitignored.

### Seed Script

File: scripts/seedPhase0Podcast.js

Creates or updates:

- Premium demo user.
- Demo series.
- Demo theme.
- Demo hosted podcast show.
- Demo published episode.
- Demo local audio asset placeholder.

Default login:

- Email: phase0@vicpods.local
- Password: Phase0Password123!

These can be changed with:

- PHASE0_SEED_EMAIL
- PHASE0_SEED_PASSWORD

## How To Run Phase 0 Checks

### 1. Run Smoke Tests

    npm run test:smoke

### 2. Run Readiness Check

The checker uses the current environment. At minimum, local development needs:

    MONGO_URI=mongodb://127.0.0.1:27017/vicpods APP_URL=http://localhost:3000 npm run phase0:check

### 3. Seed Demo Workflow

MongoDB must be running and MONGO_URI must be set:

    MONGO_URI=mongodb://127.0.0.1:27017/vicpods APP_URL=http://localhost:3000 npm run seed:phase0

After seeding, the demo public paths are:

- /podcasts/phase-0-demo-show
- /podcasts/phase-0-demo-show/feed.xml
- /podcasts/phase-0-demo-show/from-idea-to-published-podcast

## Current Baseline

VicPods already has:

- Auth, sessions, email verification, MFA, CSRF, Helmet, rate limiting, Stripe billing, and plan gating.
- Studio, Create, Kitchen, Pantry, AI, Publish, Billing, Settings, Feedback, Admin, and public podcast routes.
- Series -> Themes -> Episodes model.
- Publishing models: PodcastShow and AudioAsset.
- Public episode pages and RSS feed generation.
- Scheduled/published status fields and publish service helpers.

## Remaining Before Phase 1

Phase 0 prepares the baseline. Phase 1 should start with:

1. Public show archive page at /podcasts/:showSlug.
2. RSS validation service and UI.
3. Directory submission checklist.
4. Scheduled publishing worker.
5. Embeddable episode player.

## Risks To Watch

- The app currently attempts a database connection when app.js is imported. Future HTTP route tests should account for that or refactor startup so app creation and database connection are separate.
- Local public audio storage is fine for development, but production needs an S3-compatible storage strategy before serious hosting.
- The seeded audio file is a placeholder for workflow verification, not production-grade media.
- RSS reliability must become a core test target before public hosting is marketed.
