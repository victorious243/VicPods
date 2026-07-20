# Phase 1 Publishing Credibility

Date: 2026-07-20

## Objective

Make VicPods feel like a credible lightweight podcast host, not just a script and planning tool.

## Implemented

### Public Show Archive

- Route: /podcasts/:showSlug
- View: views/publish/show.ejs
- Shows public podcast metadata, cover artwork, RSS link, website link, embed link, and live episode list.

### Embeddable Players

- Show embed route: /podcasts/:showSlug/embed
- Episode embed route: /podcasts/:showSlug/:episodeSlug/embed
- View: views/publish/embed.ejs
- Provides a compact iframe-safe player surface.

### Feed Health Validation

- Service: services/publish/feedValidationService.js
- Checks show metadata, owner email, language, category, cover artwork, website URL, published episodes, episode titles, summaries, and audio enclosures.
- The authenticated Hosted Shows page now displays feed health status and specific blockers.

### Directory Submission Checklist

- Service: services/publish/directoryChecklistService.js
- Platforms included: Spotify, Apple Podcasts, YouTube, Amazon Music, Pocket Casts, and Overcast.
- Checklist status is blocked until feed health passes.

### Scheduled Publishing Worker

- Service: services/publish/publishSchedulerService.js
- Starts after MongoDB connects in app.js.
- Publishes due scheduled episodes on an interval and syncs show stats.
- Can be disabled with PUBLISH_SCHEDULER_DISABLED=true.

### Managed Cover Artwork Upload

- Service: services/publish/coverStorageService.js
- Route: POST /publish/shows/:showId/cover
- UI: Hosted Shows cover upload panel.
- Supports JPG, PNG, and WebP up to 5 MB.

### Tests

- File: test/phase1.publish.test.js
- Covers feed validation, directory checklist status, and cover URL helpers.

## Verification

Run:

    npm test

The Phase 1 tests run with the existing Phase 0 smoke tests.

## Still Remaining For Later Phase 1 Hardening

- Production S3-compatible storage for audio and cover artwork.
- Real image dimension validation for podcast directory artwork requirements.
- More advanced RSS validation against Apple/Spotify-specific constraints.
- Per-platform submission status persistence.
- Background job process separation for production deployments.
