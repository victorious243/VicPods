# VicPods Next Capability Roadmap

Date: 2026-07-21

## Goal

Move VicPods from a broad AI podcast planning MVP into a trustworthy premium podcast command center.

The product should become strong enough for this workflow:

`Idea -> Plan -> Record Prep -> Audio Upload -> Publish -> Distribute -> Analyze -> Grow`

VicPods should not try to clone Descript or Riverside first. The best next move is to make publishing, analytics, workflow, and monetization feel real and dependable.

## Roadmap Principles

- Trust before novelty: publishing, feeds, storage, and analytics must be reliable before advanced AI media features matter.
- Workers before integrations: anything involving scheduled publishing, webhook delivery, audio processing, analytics rollups, or email reports needs background jobs.
- Entitlements before paid feeds: private podcast monetization must know exactly who can access what.
- Handoff before heavy editing: integrate with Descript/Riverside/transcription providers before building a full editor.
- Show-level control before network-level control: make one show excellent before expanding into agency/network operations.

## Phase 1: Production Publishing Foundation

### Outcome

VicPods becomes a credible lightweight podcast host.

### Build

- Production media storage
- Audio metadata extraction
- RSS validator parity
- Background job worker
- Directory submission tracker
- Stronger public show and episode publishing controls

### Scope

- Add S3-compatible storage for audio and cover artwork.
- Keep local disk storage for development only.
- Extract audio duration, file size, MIME type, bitrate, sample rate, and channel count.
- Validate upload size, type, and podcast feed compatibility before publishing.
- Add strict artwork validation: dimensions, MIME type, file size, square aspect ratio, and public URL checks.
- Improve RSS validation against Apple/Spotify-style requirements.
- Add a persistent directory tracker for Apple Podcasts, Spotify, YouTube Podcasts, Amazon Music, Pocket Casts, Overcast, and generic RSS.
- Add update, unpublish, and scheduled publish flows with clear status.
- Add a background worker process for scheduled publishing and media jobs.

### Success Criteria

- A user can publish a real show with a stable public feed.
- RSS/feed health clearly explains every blocker.
- Published media is served from production-ready storage, not app-local disk.
- Scheduled episodes publish without someone visiting the feed or page.

## Phase 2: Podcast Import And Migration

### Outcome

Creators can bring an existing podcast into VicPods without starting over.

### Build

- Podcast import/migration
- Feed ingestion
- Episode metadata import
- Redirect/migration guidance

### Scope

- Import a public RSS feed URL.
- Parse show metadata, cover art, categories, owner email, episode titles, descriptions, GUIDs, dates, duration, and enclosure URLs.
- Let users choose between referencing external audio or re-hosting uploaded audio later.
- Map imported episodes into VicPods shows and episode records.
- Preserve GUIDs where appropriate.
- Generate a migration checklist: old host redirect, feed ownership, directory update, validation status.

### Success Criteria

- A creator can import an existing show and see episodes in VicPods.
- VicPods can validate the imported feed and show a migration plan.
- No imported episode loses title, date, GUID, audio URL, or description.

## Phase 3: Real Analytics And Retention Loop

### Outcome

VicPods becomes useful after publishing, not only before publishing.

### Build

- Real analytics aggregation
- Weekly performance email
- Better attribution and bot filtering
- Growth recommendations

### Scope

- Schedule daily analytics rollups through the background worker.
- Track feed requests, audio downloads, web player plays/completions, share clicks, referrers, apps/platforms, devices, and country/region signals.
- Improve bot filtering and download attribution rules.
- Add show and episode comparison.
- Add CSV export for show-level and episode-level analytics.
- Send weekly performance emails with top episode, growth trend, traffic source, and one recommended next action.
- Add launch report email after a new episode goes live.

### Success Criteria

- Analytics update automatically without manual scripts.
- Users can understand which episode worked and why.
- Weekly emails give creators a reason to return to VicPods.

## Phase 4: Recording And Post-Record Media Workflow

### Outcome

VicPods becomes useful on recording day and immediately after recording.

### Build

- Transcript upload/transcription provider
- Chapter markers
- Social clip/quote-card generator
- Audio cleanup/transcription handoff

### Scope

- Add transcript upload for `.txt`, `.vtt`, `.srt`, and `.docx` where practical.
- Add provider abstraction for transcription, starting with one real provider.
- Store transcript status, provider job id, language, timestamps, and confidence where available.
- Generate chapter markers from outline, transcript timestamps, or manual input.
- Export chapters in formats useful for RSS/show notes.
- Generate clip ideas with timestamp ranges from transcript sections.
- Generate quote cards using show brand kit and episode highlights.
- Add Descript/Riverside handoff packs with transcript, notes, guest prep, and clip candidates.

### Success Criteria

- A user can upload audio/transcript and get usable chapters, quotes, and clip ideas.
- VicPods improves the post-record workflow without becoming a heavy editor.

## Phase 5: Premium Show Website Layer

### Outcome

VicPods public show pages become a serious alternative to basic podcast websites.

### Build

- Custom show website settings
- Custom domain support
- SEO and share customization

### Scope

- Add show website settings: theme, accent color, hero layout, about section, host bio, social links, support links, featured episode, trailer, and newsletter CTA.
- Add Open Graph controls for show and episode pages.
- Add custom domain model and verification fields.
- Support CNAME verification instructions.
- Add domain status checks and SSL readiness status.
- Add canonical URL behavior for custom domains.

### Success Criteria

- A creator can share a polished public show site hosted by VicPods.
- Premium users can connect a custom domain safely.

## Phase 6: Real Teams And Approval Workflows

### Outcome

VicPods can support serious creators, producers, guests, and agencies.

### Build

- Real collaborator invites and auth
- Route-level role enforcement
- Approval blocking
- Activity log

### Scope

- Send collaborator invite emails.
- Let invitees create accounts or link existing accounts.
- Enforce per-show permissions on routes and actions.
- Support owner, producer, editor, analyst, and guest access.
- Add approval requirements that can block publishing.
- Add activity/audit log for invite, edit, comment, approve, publish, and monetization actions.

### Success Criteria

- A team can operate a show without sharing one login.
- Guests can access only what they need.
- Publishing can require producer/owner approval.

## Phase 7: Monetized Private Feeds

### Outcome

VicPods helps creators earn money, not only pay VicPods.

### Build

- Paid private feeds with Stripe entitlements
- Subscriber access management
- Private feed analytics

### Scope

- Add creator-side Stripe Connect or a simpler managed Stripe entitlement model.
- Create listener/subscriber records.
- Tie private feed tokens to active paid entitlements.
- Revoke feed access when payment fails or subscription ends.
- Add subscriber import/export.
- Add premium episode visibility controls.
- Add private-feed access logs and basic subscriber analytics.

### Success Criteria

- A creator can sell private/premium podcast access.
- Only entitled subscribers can access private RSS feeds.
- Payment status changes update feed access automatically.

## Phase 8: Integration Delivery Layer

### Outcome

VicPods connects reliably to the tools creators already use.

### Build

- Webhook delivery worker with retry logs
- Zapier/webhook integration first
- Native integrations later

### Scope

- Implement webhook delivery worker.
- Add retry policy, exponential backoff, status logs, response body capture, and dead-letter state.
- Add manual retry button.
- Support core event types:
  - episode.published
  - episode.scheduled
  - analytics.weekly_summary
  - team.approval_requested
  - private_feed.subscriber_created
- Publish Zapier-compatible webhook documentation.
- Add signed webhook payloads.
- Later add native integrations: Mailchimp, ConvertKit, Google Drive, Notion, Slack, Descript, Riverside.

### Success Criteria

- Webhooks actually deliver to external URLs.
- Users can inspect failures and retry safely.
- Zapier can receive VicPods events before native integrations are built.

## Recommended Build Order

1. Background job worker
2. Production media storage
3. Audio metadata extraction
4. RSS validator parity
5. Directory submission tracker
6. Real analytics aggregation
7. Weekly performance email
8. Podcast import/migration
9. Transcript upload/transcription provider
10. Chapter markers
11. Social clip/quote-card generator
12. Custom show website settings
13. Custom domain support
14. Real collaborator invites and auth
15. Paid private feeds with Stripe entitlements
16. Webhook delivery worker with retry logs
17. Zapier/webhook integration documentation

## Suggested Milestones

### Milestone A: Trustworthy Host

Includes phases 1 and 2.

Ship when users can publish, validate, submit, schedule, and import podcasts with confidence.

### Milestone B: Growth Engine

Includes phase 3.

Ship when analytics aggregate automatically and weekly reports drive creators back into VicPods.

### Milestone C: Production Assistant

Includes phase 4.

Ship when transcripts, chapters, clips, and quote cards make VicPods useful after recording.

### Milestone D: Premium Presence

Includes phase 5.

Ship when show websites and custom domains are strong enough to be part of Premium pricing.

### Milestone E: Pro Workflow

Includes phase 6.

Ship when collaborators have real accounts, invites, permissions, and approval gates.

### Milestone F: Creator Revenue

Includes phase 7.

Ship when creators can sell private feeds with real payment-based access.

### Milestone G: Connected Studio

Includes phase 8.

Ship when webhook delivery is reliable and Zapier can connect VicPods to external workflows.

## Product Packaging Recommendation

### Free

- Idea generation
- Limited AI planning
- Public preview
- Basic TXT export
- No production hosting

### Pro

- One hosted show
- Production RSS feed
- Audio upload and publishing
- Standard analytics
- Directory tracker
- Scheduled publishing
- Episode embeds

### Premium

- Multiple shows
- Advanced analytics
- Custom show website settings
- Custom domain
- Private feeds
- Collaborators
- Priority media processing
- Webhooks/Zapier

## Key Risks

- Building advanced AI media before publishing is trusted.
- Selling team features before route-level permissions are enforced.
- Selling private feeds before Stripe entitlements are reliable.
- Treating analytics as finished before bot filtering and scheduled rollups exist.
- Adding too many native integrations before webhook delivery is solid.

## North Star

VicPods should make creators feel:

> I know what to record, I know how to publish it, I know how it performed, and I know what to make next.
