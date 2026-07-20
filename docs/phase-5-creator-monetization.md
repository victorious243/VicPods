# Phase 5: Creator Monetization

Date: 2026-07-20

## Goal

Help podcasters earn money from the work they already publish in VicPods.

## Implemented

- Show-level listener support links for public show and episode pages.
- Show-level sponsor profile fields: audience summary, sponsor pitch, contact email, and rate card.
- Premium/private episode visibility fields.
- Token-gated private RSS feed route.
- Sponsor media kit view in Studio.
- Sponsor outreach email templates.
- Ad slot planner for pre-roll, mid-roll, and post-roll inventory.
- Phase 5 test coverage for support links, media kit generation, outreach templates, ad planning, private feed URLs, and public-feed premium exclusion.

## Routes

- /studio/monetization - creator monetization workspace.
- /studio/monetization/shows/:showId - save show monetization settings.
- /podcasts/:showSlug/private/:feedToken/feed.xml - token-gated private RSS feed.

## Notes

- This phase does not process payments. Support links point to external listener-support platforms for now.
- This phase does not create an ad marketplace. It prepares the creator with sponsor material and inventory planning first.
- Premium/private episode visibility is now modeled, but entitlement/payment enforcement should be added before selling paid access directly inside VicPods.
