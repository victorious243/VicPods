# Phase 7: Advanced Media And Integrations

Date: 2026-07-20

## Goal

Give VicPods deeper platform power around publishing, growth, media handoff, and creator production workflows.

## Implemented

- Integration connection model for webhooks, Zapier, email platforms, social schedulers, Descript, Riverside, and cleanup providers.
- Webhook delivery model and event payload builder.
- Media processing job model for clips, captions, cleanup, editor exports, and recorder sessions.
- Episode advanced media fields for external projects, AI clip suggestions, captions, cleanup requests, and recorder session setup.
- Studio integrations dashboard at /studio/integrations.
- Episode advanced media panel for:
  - AI clip suggestions
  - caption draft generation
  - audio cleanup request tracking
  - Descript export queue
  - Riverside export queue
  - external project metadata
  - lightweight recorder session notes/room URL
- Descript and Riverside export pack builders.
- Phase 7 tests for integration normalization, webhook payloads, clip/caption generation, export packs, and schema coverage.

## Routes

- /studio/integrations - integration and media operations dashboard.
- /studio/integrations/connections - save integration connection.
- /kitchen/:seriesId/themes/:themeId/episodes/:episodeId/advanced-media - update episode media workflow and queue media jobs.

## Notes

- Webhook records are queued and payloads are stored, but outbound HTTP delivery worker/retry logic is not implemented yet.
- Email/social integrations are configured as connection records first; actual OAuth/API delivery should be added per provider.
- AI clips and captions are deterministic local drafts for now. A production media processor can replace the internals without changing the UI contract.
- Audio cleanup is request tracking. Actual cleanup should connect to an external processor such as Auphonic, Adobe Enhance, or a custom worker.
- Lightweight recording is represented as room URL/session metadata, not an in-browser recorder yet.
