# VicPods MVP

VicPods is a subscription-ready podcast planning and launch-prep SaaS MVP built with Express + EJS + MongoDB.

## Features
- Email/password auth with sessions (`express-session` + `bcrypt`)
- Optional Google OpenID Connect login
- Terms and Conditions acceptance required at registration
- Email PIN verification required before first login
- New-user MFA: sign-in security code (email OTP) for the first 14 days by default
- Protected Studio, Kitchen, Pantry, Billing routes
- Kitchen workflow for Series -> Themes -> Episodes
- Theme-based workflow: Series -> Themes -> Episodes
- Pantry idea bank with CRUD
- Chef AI endpoints with provider abstraction (`openai` or deterministic `mock`)
- Continuity guard (`seriesSummary` + `endState` flow)
- Theme continuity guard (`themeSummary` + theme-local episode `endState`)
- Release Readiness Score with blockers, strengths, and next actions
- Show Notes Pack generation for summary, takeaways, CTA, and social copy
- Ready/Served Episode Brief generation + export (`txt`, `pdf`, `docx`)
- Stripe subscription billing (Checkout + Customer Portal + Webhooks)
- Plan gating middleware (`requirePlan`) with auto-expiry downgrade logic
- Security hardening: Helmet headers, CSRF protection, auth rate limiting, Mongo-backed sessions

## Tech
- Node.js
- Express
- EJS
- MongoDB + Mongoose
- dotenv
- Stripe

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create environment file:
   ```bash
   cp .env.example .env
   ```
3. Start MongoDB locally (or use Atlas via `MONGO_URI`).
4. Run app:
   ```bash
   npm start
   ```
5. (Optional) Seed an admin user with premium plan:
   ```bash
   ADMIN_EMAIL=admin@vicpods.app ADMIN_PASSWORD='StrongPass123!' npm run seed:admin
   ```
6. Open:
   ```
   http://localhost:3000
   ```
7. (Optional) Validate SMTP delivery:
   ```bash
   npm run email:test
   ```

## Environment Variables
```env
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/vicpods
SESSION_SECRET=change_this_to_a_random_32_plus_char_secret
AI_PROVIDER=openai
OPENAI_API_KEY=
APP_URL=http://localhost:3000
NEW_USER_MFA_DAYS=14
GOOGLE_OIDC_ISSUER_URL=https://accounts.google.com
GOOGLE_OIDC_CLIENT_ID=
GOOGLE_OIDC_CLIENT_SECRET=
GOOGLE_OIDC_REDIRECT_URI=http://localhost:3000/auth/google/callback
GOOGLE_OIDC_SCOPES=openid email profile
LEGAL_ENTITY_NAME=VicPods Ltd
LEGAL_TRADING_NAME=VicPods
LEGAL_COUNTRY=Ireland
LEGAL_ADDRESS=Street Line 1|City|Postcode|Ireland
PRIVACY_CONTACT_EMAIL=privacy@vicpods.com
SUPPORT_CONTACT_EMAIL=hello@vicpods.com
LEGAL_CONTACT_EMAIL=legal@vicpods.com
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_brevo_smtp_login
SMTP_PASS=your_brevo_smtp_key
SMTP_FROM="VicPods <sender@verified-domain-you-own.com>"
EMAIL_TEST_TO=you@example.com
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_BILLING_CURRENCY=eur
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_PREMIUM=price_...
BILLING_CURRENCY_SYMBOL=€
BILLING_INTERVAL_LABEL=/mo
BILLING_FOUNDING_DEADLINE_LABEL=March 31, 2026
BILLING_PRICE_FREE=0
BILLING_PRICE_PRO=19
BILLING_PRICE_PREMIUM=39
BILLING_PRICE_PRO_STANDARD=29
BILLING_PRICE_PREMIUM_STANDARD=59
```

If `AI_PROVIDER=openai` but `OPENAI_API_KEY` is empty, VicPods automatically falls back to deterministic mock AI output.

## Key Routes
- Auth: `/auth/register`, `/auth/login`, `/auth/google/login`, `/auth/logout`, `/auth/terms`, `/auth/verify`, `/auth/verify/resend`, `/auth/mfa`, `/auth/mfa/resend`
- Legal: `/terms`, `/privacy-policy`, `/cookie-policy`, `/data-rights`
- Google callback: `/auth/google/callback` (also supported: `/oauth2callback`)
- Studio: `/studio`
- Kitchen: `/kitchen`, `/kitchen/:seriesId`, `/kitchen/:seriesId/themes/:themeId/episodes/:episodeId`
- Episode brief: `POST /kitchen/:seriesId/themes/:themeId/episodes/:episodeId/transcript/generate`, `GET /kitchen/:seriesId/themes/:themeId/episodes/:episodeId/transcript/download?format=pdf|docx|txt`
- Pantry: `/pantry`
- AI: `/ai/episode/generate`, `/ai/spices/generate`, `/ai/continuity/refresh`
- Billing: `/billing`, `POST /billing/checkout`, `POST /billing/portal`, `/billing/success`, `/billing/cancel`
- Webhook: `POST /webhooks/stripe`

## Notes
- New users must accept Terms and verify email with a 6-digit PIN before account activation.
- Verification PINs expire after 15 minutes.
- In non-production only, if SMTP is missing, email delivery falls back to a local development flow.
- `SMTP_FROM` must be a real sender address on a domain you have verified with your SMTP provider.
- In production, SMTP must be configured and verification emails must deliver successfully.
- Google login is enabled only when Google OIDC env vars are configured.
- Stripe webhooks are the source of truth for plan activation/cancellation/expiry.
- `/ai/continuity/refresh` is gated to Pro+ (`requirePlan('pro')`).
- Daily generation limits: Free `5/day`, Pro `50/day`, Premium `unlimited`.
- Episode Brief export tiers: Free `TXT`, Pro `TXT+PDF`, Premium `TXT+PDF+DOCX`.
- Founding launch pricing defaults are Free `€0`, Pro `€19/mo`, and Premium `€39/mo` through `March 31, 2026`.
- Legacy series episodes are auto-migrated into a `General` theme when first opened.

## Stripe Webhook Dev
Use Stripe CLI in development:
```bash
stripe listen --forward-to localhost:3000/webhooks/stripe
```

## Stripe Plan Bootstrap
You can create/find VicPods Pro/Premium monthly Stripe prices and write IDs to `.env` automatically:
```bash
npm run stripe:setup-plans
```
