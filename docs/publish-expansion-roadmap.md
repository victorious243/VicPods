# VicPods Publish Expansion Roadmap

## Objective

Upgrade VicPods from:

- `plan -> script`

to:

- `plan -> script -> publish`

The goal is not to become a full audio editor. The goal is to make subscription revenue stronger by owning the highest-value step after an episode is ready: getting it live.

## Why This Direction Fits VicPods

VicPods already has:

- creation workflows for single episodes and series
- AI-assisted draft generation
- launch-pack generation
- release-readiness scoring
- plan gating and Stripe subscriptions

That means the strongest commercial expansion is publishing and hosting, not audio editing. Publishing extends the existing workflow. Full editing would force a second product shape, a different frontend, media pipelines, and a much larger infrastructure jump.

## Product Principle

Do not sell storage.

Sell this outcome:

- "Your episode is planned, structured, polished, and now publishable from the same workspace."

That is the value users will pay for every month.

## Monetization Strategy

### What should push users to upgrade

The upgrade moment should happen when a user has already done the work and is ready to go live.

Primary paywall:

- `Publish this episode`

Secondary paywalls:

- RSS feed activation
- scheduled publishing
- public show website
- advanced analytics
- multiple shows
- collaborators
- custom domain
- private podcast feeds

### Recommended packaging

#### Free

- public episode preview
- idea generation
- limited planning and drafting
- limited exports
- no serious hosting
- no real RSS feed

#### Pro

- one hosted show
- RSS feed
- upload final audio
- publish episode pages
- schedule publishing
- standard analytics
- transcript and chapter support later

#### Premium

- multiple hosted shows
- collaborators / team roles
- private podcast feed
- custom domain
- advanced analytics
- higher upload / download scale

### Add-ons after the core launch

- extra download blocks
- transcript credits
- video episode hosting
- private subscriber seats
- dynamic ad tools

## Conversion Design

### Best upgrade moments inside the current app

1. When an episode reaches `Ready`
   Show a locked `Publish` CTA beside export actions.

2. When a user has multiple `Ready` episodes but no live feed
   Show "You already have enough content to launch a real show."

3. When a user tries to share externally
   Offer public episode pages and hosted show pages on paid plans.

4. On the billing page
   Reframe plans around publishing outcomes, not AI limits.

### Messaging that should convert

- "You already planned the episode. Publish it from the same workspace."
- "Turn Ready into Live."
- "Stop exporting drafts into a separate host."
- "Launch your show without rebuilding metadata somewhere else."

## Product Scope: What To Build First

## Phase 1: Publish Foundation

This is the first monetizable release.

### User-facing features

- create a hosted show
- upload final episode audio
- set episode title, summary, artwork, publish date, explicit flag
- publish a public episode page
- generate a valid podcast RSS feed
- copy feed URL for Spotify / Apple Podcasts submission
- schedule future publishing

### What this unlocks commercially

- real recurring value
- higher switching cost
- strong upgrade reason for users who already create in VicPods

### Recommended paywall

- `Pro` and above

### Required model changes

#### New model: `PodcastShow`

Suggested fields:

- `userId`
- `name`
- `slug`
- `description`
- `authorName`
- `ownerEmail`
- `language`
- `categoryPrimary`
- `categorySecondary`
- `coverImageUrl`
- `websiteUrl`
- `copyright`
- `explicit`
- `feedStatus`
- `publishedEpisodeCount`
- `lastPublishedAt`

#### New model: `AudioAsset`

Suggested fields:

- `userId`
- `episodeId`
- `storageProvider`
- `storageKey`
- `originalFilename`
- `mimeType`
- `byteSize`
- `durationSeconds`
- `bitrateKbps`
- `status`
- `processedAt`

#### Extend `Episode`

Suggested fields:

- `showId`
- `summary`
- `publicSlug`
- `publishStatus` with values like `draft`, `scheduled`, `published`
- `scheduledFor`
- `publishedAt`
- `audioAssetId`
- `durationSeconds`
- `seasonNumber`
- `episodeNumberForFeed`
- `explicit`
- `publicPageEnabled`
- `rssGuid`

## Phase 2: Hosting And Distribution Layer

This phase makes the publish module feel like a real host, not a feed generator.

### User-facing features

- public show landing page
- show-level archive page
- embeddable player
- RSS validation feedback
- distribution checklist for Apple / Spotify / YouTube Podcasts
- episode update / unpublish flows

### Recommended paywall

- `Pro` for core hosting
- `Premium` for custom domain and branded public site control

### Required services

- `services/storage/assetStorageService.js`
- `services/audio/audioIngestService.js`
- `services/publish/rssFeedService.js`
- `services/publish/publicSiteService.js`
- `services/publish/publishSchedulerService.js`

## Phase 3: Analytics And Retention

This is the second major conversion layer after hosting.

### User-facing features

- downloads by episode
- top episodes
- publish cadence tracking
- show growth trends
- source / platform breakdown later

### Why this matters

Hosting gets the user in. Analytics keeps them paying.

### Recommended paywall

- basic download counts in `Pro`
- deeper trends and comparisons in `Premium`

### New model

#### `EpisodeAnalyticsDaily`

Suggested fields:

- `showId`
- `episodeId`
- `date`
- `downloads`
- `uniqueListenersEstimate`
- `platformBreakdown`
- `countryBreakdown`

## Phase 4: Team And Network Value

This is where average revenue per account rises.

### User-facing features

- multiple shows
- collaborators
- editor / owner roles
- agency dashboard
- network-level analytics

### Recommended paywall

- `Premium` or a higher business tier

## Phase 5: Light Audio Utilities

Add these only after hosting is working.

### Good additions

- trim start / end
- loudness normalization
- silence detection
- chapter markers
- transcript sync

### Avoid for now

- full timeline editing
- multitrack editing
- DAW-style effects chains
- browser-native heavy editing UI

Those features are expensive and move VicPods away from its current strength.

## Required Route And Controller Additions

### New routes

- `routes/shows.js`
- `routes/publish.js`
- `routes/publicShows.js`

### New route patterns

- `GET /shows`
- `GET /shows/new`
- `POST /shows`
- `GET /shows/:showId`
- `POST /shows/:showId/settings`
- `POST /episodes/:episodeId/audio`
- `POST /episodes/:episodeId/publish`
- `POST /episodes/:episodeId/schedule`
- `GET /feed/:showSlug.xml`
- `GET /shows/:showSlug`
- `GET /shows/:showSlug/:episodeSlug`

### New controllers

- `controllers/showController.js`
- `controllers/publishController.js`
- `controllers/publicShowController.js`
- `controllers/analyticsController.js`

## UI Changes Inside The Existing App

### Studio

Add:

- live shows count
- published episodes count
- latest published episodes
- analytics entry point

### Kitchen episode editor

Add a new publish panel when an episode is `Ready`:

- upload final audio
- add summary
- set publish date
- publish now / schedule

If the user is on free:

- show locked publish module
- show direct upgrade CTA

### Settings / Billing

Reposition plan value:

- not "more AI generations"
- but "host and publish your show from VicPods"

## Implementation Order For This Repo

## Sprint 1: The First Paid Feature

Build this first:

- `PodcastShow` model
- extend `Episode` with publish metadata
- show creation screen
- upload final MP3 for an episode
- publish episode page
- generate RSS feed for one show
- gate all of that behind `requirePlan('pro')`

This is the first version that can directly drive upgrades.

## Sprint 2

- schedule publishing
- public show page
- feed validation checks
- show settings UI

## Sprint 3

- basic analytics
- billing page rewrite around publish value
- in-app upgrade prompts at `Ready` stage

## Sprint 4

- multi-show support improvements
- custom domain support
- collaborator roles

## Technical Notes

### Storage

Do not store uploaded audio in MongoDB.

Use object storage:

- S3
- Cloudflare R2
- Backblaze B2

Keep only metadata in MongoDB.

### Background work

Audio ingest, duration detection, waveform generation, normalization, and scheduled publishing should run as jobs, not inside normal request/response flows.

### Feed safety

Feed generation must be deterministic, cached, and validated. Broken RSS will damage trust quickly.

## Success Metrics

Track these after launch:

- percent of `Ready` episodes that hit the publish paywall
- free -> pro upgrade rate after publish CTA exposure
- active published shows
- published episodes per week
- monthly retained pro accounts with at least one live show
- share of paid users who publish from VicPods instead of exporting elsewhere

## Recommendation

The next build should be:

- `Ready -> Publish`

not:

- `Draft -> Fancy Editing`

That is the shortest path from the current product to stronger subscription conversion.
