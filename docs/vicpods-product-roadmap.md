# VicPods Product Roadmap

Date: 2026-07-20

## Product Goal

Make VicPods the AI operating system for podcasters:

> A creator starts with a rough idea, turns it into a strong episode plan, records with confidence, publishes from the same workspace, learns what worked, and grows the show.

VicPods should compete first on workflow, intelligence, and publishing confidence. It should not start by trying to clone Descript or Riverside's full media editors.

## North Star

Creators should be able to move one episode through this complete path:

Idea -> Plan -> Script -> Record Prep -> Audio Upload -> Publish -> Distribution -> Analytics -> Growth Recommendation

## Strategy

### What VicPods Must Become

- A trusted lightweight podcast host.
- A creator command center for every show and episode.
- An AI strategy layer that tells podcasters what to do next.
- A growth system that turns analytics into recommendations.

### What VicPods Should Avoid Early

- Building a full multitrack editor.
- Building a full remote recording studio before proving demand.
- Building complex ad marketplaces before analytics and audience scale exist.
- Copying every competitor feature without a clear workflow reason.

## Roadmap Overview

| Phase | Theme | Outcome | Priority |
| --- | --- | --- | --- |
| 0 | Foundation audit | Stabilize current product and clarify scope | Immediate |
| 1 | Publishing credibility | Users can trust VicPods to host and publish a real show | Highest |
| 2 | Studio command center | Users always know the next best action | Highest |
| 3 | Analytics and growth loop | Users return after publishing because VicPods shows results | High |
| 4 | Recording-day workflow | VicPods becomes useful while preparing to record | High |
| 5 | Creator monetization | VicPods helps podcasters earn money | Medium |
| 6 | Teams and pro workflows | Agencies, networks, and teams can operate inside VicPods | Later |
| 7 | Advanced media and integrations | VicPods integrates or selectively builds recording/editing capabilities | Later |

## Phase 0: Foundation Audit

### Goal

Make sure the existing app is stable enough to build on.

### Build

- Confirm all core routes work: Studio, Kitchen, Pantry, Publish, Billing, Settings.
- Add smoke tests for auth-protected pages and publish routes.
- Add seed data for one complete podcast workflow.
- Document current data model relationships.
- Confirm production environment requirements: MongoDB, Stripe, SMTP, storage, app URL, session secret.
- Decide storage strategy for audio and artwork: local dev, S3-compatible production.

### Engineering Tasks

- Add route smoke tests.
- Add publish workflow fixture/seed.
- Add environment readiness check script.
- Review indexes on Series, Theme, Episode, PodcastShow, AudioAsset.
- Ensure upload limits and file handling are explicit.

### Success Criteria

- A developer can run the app locally and create a show, episode, audio upload, public page, and feed.
- The team knows what is production-ready and what is placeholder.

## Phase 1: Publishing Credibility

### Goal

Make VicPods credible as a lightweight podcast host.

### User Outcome

A creator can launch a real podcast feed, submit it to major directories, share a show page, and schedule episodes without leaving VicPods.

### Build

- Public show archive page at /podcasts/:showSlug.
- RSS validation panel showing missing required metadata.
- Directory submission checklist for Spotify, Apple Podcasts, YouTube Podcasts, Amazon Music, Pocket Casts, Overcast, and RSS.
- Embeddable episode player.
- Embeddable show player later in the phase.
- Scheduled publishing worker that publishes due episodes automatically.
- Cover artwork upload and validation.
- Audio metadata extraction: duration, bitrate, MIME type, size.
- Clear update and unpublish flows.
- Public show SEO and Open Graph metadata.

### Engineering Tasks

- Extend PodcastShow with directory statuses, artwork asset fields, and validation metadata.
- Extend AudioAsset processing status and metadata fields if needed.
- Add feed validation service.
- Add scheduler job for due episodes.
- Add show archive controller/view.
- Add player embed route with minimal layout.
- Add tests for RSS XML, show archive, scheduled publishing, and embed routes.

### KPI

- A new user can publish a complete show and submit the feed within 30 minutes.
- RSS feed passes validator checks for core podcast fields.

## Phase 2: Studio Command Center

### Goal

Make Studio the home base for podcast operations.

### User Outcome

When a creator opens VicPods, they immediately know what needs attention and what to do next.

### Build

- Pipeline board: Idea -> Draft -> Ready -> Recorded -> Scheduled -> Live.
- Episode detail tabs: Plan, Script, Record, Publish, Grow.
- Next-best-action cards: finish draft, improve readiness score, upload audio, schedule episode, fix feed metadata, submit feed, review analytics.
- Creator calendar for planned, recording, scheduled, and published episodes.
- Global search across series, themes, episodes, transcripts, and shows.
- Strong empty states for new podcasters.
- Unified show dashboard with status, episodes, feed health, and growth prompts.

### Engineering Tasks

- Add workflow status mapping across existing Episode fields.
- Add Studio aggregation service.
- Add calendar query endpoints.
- Add global search service and indexes.
- Redesign Studio view around operational cards and pipeline.
- Add tests for aggregation logic.

### KPI

- 80% of active users can identify their next useful action from Studio without opening another page.

## Phase 3: Analytics And Growth Loop

### Goal

Make VicPods useful after publishing.

### User Outcome

A creator can see which episodes are working, where listeners come from, and what to create next.

### Build

- Podcast analytics models for feed requests, audio downloads, player events, share link clicks, and daily rollups.
- Dashboard metrics: downloads/listens over time, top episodes, platform/app breakdown, country/region breakdown, referrer/source breakdown, device breakdown, episode comparison.
- Weekly show performance email.
- Launch report after an episode goes live.
- AI growth recommendations: best topics, weak hooks, suggested next episodes, promotion ideas.

### Engineering Tasks

- Add PodcastAnalyticsEvent and EpisodeAnalyticsDaily models.
- Add tracking middleware for feed/audio routes.
- Add player event endpoint.
- Add daily aggregation job.
- Add analytics dashboard controller/view.
- Add CSV export.
- Add weekly summary email service using analytics data.

### KPI

- Published users return weekly because analytics and recommendations provide useful next actions.

## Phase 4: Recording-Day Workflow

### Goal

Extend VicPods into the recording moment without building a heavy editor.

### User Outcome

A creator can open VicPods before recording and have the script, questions, checklist, and notes ready.

### Build

- Teleprompter/read mode from generated scripts.
- Guest prep sheet.
- Interview question builder.
- Recording checklist.
- Session notes attached to an episode.
- Post-record upload flow.
- Transcript import.
- AI cleanup suggestions from transcript: unclear sections, filler-heavy moments, missing CTA, weak intro/outro.
- Export helpers for Descript/Riverside workflows.

### Engineering Tasks

- Add recording tab to episode view.
- Add session notes field/model.
- Add teleprompter frontend mode.
- Add guest prep generator prompt/service.
- Add transcript import endpoint.
- Add post-record upload CTA and state transition.

### KPI

- A creator can run a recording session using VicPods as the preparation surface.

## Phase 5: Creator Monetization

### Goal

Help podcasters make money, not only pay VicPods.

### User Outcome

A creator can add support links, package sponsor information, and plan monetized episodes.

### Build

- Listener support links on show and episode pages.
- Premium/bonus episode flags.
- Private RSS feeds.
- Sponsor media kit generator.
- Sponsor outreach email templates.
- Ad slot planner for pre-roll, mid-roll, post-roll.
- Basic campaign tracking fields.

### Engineering Tasks

- Extend PodcastShow with support links and monetization settings.
- Add private feed token model.
- Add media kit generation service.
- Add sponsor kit view/export.
- Add premium episode visibility rules.
- Add tests around private feed access.

### KPI

- Creators can create a sponsor-ready media kit in under 10 minutes.

## Phase 6: Teams And Pro Workflows

### Goal

Make VicPods useful for serious creators, agencies, and networks.

### User Outcome

Multiple people can manage a show without sharing one login.

### Build

- Per-show collaborators.
- Roles: owner, producer, editor, analyst, guest.
- Episode comments and tasks.
- Approval workflow.
- Brand kit and reusable show defaults.
- Multi-show dashboard.
- Network dashboard later.

### Engineering Tasks

- Add collaborator model and authorization middleware.
- Add role checks for show/episode actions.
- Add comments/tasks model.
- Add approval states to episodes.
- Add multi-show aggregation.

### KPI

- A team can operate a show with clear ownership and approval states.

## Phase 7: Advanced Media And Integrations

### Goal

Compete more deeply with mature podcast platforms without losing VicPods' AI workflow identity.

### Build

- Zapier/webhook integrations.
- Mailchimp/ConvertKit email integrations.
- Social auto-sharing.
- Descript/Riverside import/export.
- Audio cleanup via external processing provider.
- AI clip suggestions.
- Captions and quote cards.
- Lightweight browser recorder only if validated by user demand.
- Dynamic audio insertion later.

### KPI

- VicPods connects smoothly to the tools creators already use.

## First 90 Days

### Days 1-15: Stabilize And Prepare

- Run full app locally with seed data.
- Add smoke tests for major routes.
- Confirm upload/storage strategy.
- Audit publish flow end to end.
- Finalize Phase 1 feature scope.

### Days 16-35: Publishing Credibility

- Build show archive page.
- Build RSS validation service and UI.
- Build directory checklist.
- Add scheduled publishing worker.
- Add cover artwork upload/validation.

### Days 36-50: Player And Public Experience

- Build embeddable episode player.
- Improve public episode/show SEO.
- Add update/unpublish flows.
- Add audio metadata extraction.
- Add tests around RSS, public pages, player, and scheduler.

### Days 51-70: Studio Command Center

- Build pipeline board.
- Build next-best-action cards.
- Add episode tabs: Plan, Script, Record, Publish, Grow.
- Add creator calendar.
- Add global search foundation.

### Days 71-90: Analytics Foundation

- Add analytics event models.
- Track feed/audio/player events.
- Build first analytics dashboard.
- Add launch report email.
- Add first AI growth recommendations.

## MVP Release Targets

### Release 1: Publish-Ready VicPods

Must include:

- hosted show
- public show page
- public episode page
- valid RSS feed
- audio upload
- scheduled publishing
- directory checklist
- embeddable player

### Release 2: Command Center VicPods

Must include:

- Studio pipeline
- next-best actions
- creator calendar
- episode tabs
- feed health visibility

### Release 3: Growth VicPods

Must include:

- download/feed/player analytics
- weekly report
- launch report
- AI recommendations

## Pricing Alignment

### Free

- Idea generation.
- Limited planning.
- Public preview.
- No real podcast hosting.

### Pro

- One hosted show.
- RSS feed.
- Public show and episode pages.
- Audio upload.
- Scheduled publishing.
- Standard analytics.

### Premium

- Multiple shows.
- Advanced analytics.
- Custom domain.
- Private feeds.
- Collaborators.
- Sponsor media kit.

## Key Risks

### Media Infrastructure Cost

Audio hosting can become expensive. Start with clear upload/download limits and usage tracking.

### RSS Reliability

Bad feeds destroy trust. Treat RSS validation and tests as core product infrastructure.

### Scope Creep Into Editing

Full editing is a separate product. Start with prep, upload, transcript import, and integrations.

### Weak Analytics Quality

Analytics must be useful, not decorative. Track the events that drive creator decisions.

### Product Complexity

VicPods already has many modules. Studio must simplify the product, not add another confusing layer.

## Recommended Immediate Next Build

Start with Phase 1:

1. Public show archive page.
2. RSS validation panel.
3. Directory submission checklist.
4. Scheduled publishing worker.
5. Embeddable episode player.

This closes the most urgent competitor gap and makes VicPods feel like a real podcast platform.
