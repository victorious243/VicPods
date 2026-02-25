# VicPods MVP

VicPods is a subscription-ready podcast SaaS MVP built with Express + EJS + MongoDB.

## Features
- Email/password auth with sessions (`express-session` + `bcrypt`)
- Protected Studio, Kitchen, Pantry, Billing routes
- Kitchen workflow for Series -> Themes -> Episodes
- Theme-based workflow: Series -> Themes -> Episodes
- Pantry idea bank with CRUD
- Chef AI endpoints with provider abstraction (`openai` or deterministic `mock`)
- Continuity guard (`seriesSummary` + `endState` flow)
- Theme continuity guard (`themeSummary` + theme-local episode `endState`)
- Served-only transcript generation + export (`txt`, `pdf`, `docx`)
- Stripe subscription billing (Checkout + Customer Portal + Webhooks)
- Plan gating middleware (`requirePlan`) with auto-expiry downgrade logic

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

## Environment Variables
```env
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/vicpods
SESSION_SECRET=some_long_secret
AI_PROVIDER=openai
OPENAI_API_KEY=
APP_URL=http://localhost:3000
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_BILLING_CURRENCY=eur
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_PREMIUM=price_...
BILLING_CURRENCY_SYMBOL=€
BILLING_INTERVAL_LABEL=/mo
BILLING_PRICE_FREE=0
BILLING_PRICE_PRO=12.95
BILLING_PRICE_PREMIUM=16.95
```

If `AI_PROVIDER=openai` but `OPENAI_API_KEY` is empty, VicPods automatically falls back to deterministic mock AI output.

## Key Routes
- Auth: `/auth/register`, `/auth/login`, `/auth/logout`
- Studio: `/studio`
- Kitchen: `/kitchen`, `/kitchen/:seriesId`, `/kitchen/:seriesId/themes/:themeId/episodes/:episodeId`
- Transcript: `POST /kitchen/:seriesId/themes/:themeId/episodes/:episodeId/transcript/generate`, `GET /kitchen/:seriesId/themes/:themeId/episodes/:episodeId/transcript/download?format=pdf|docx|txt`
- Pantry: `/pantry`
- AI: `/ai/episode/generate`, `/ai/spices/generate`, `/ai/continuity/refresh`
- Billing: `/billing`, `POST /billing/checkout`, `POST /billing/portal`, `/billing/success`, `/billing/cancel`
- Webhook: `POST /webhooks/stripe`

## Notes
- Stripe webhooks are the source of truth for plan activation/cancellation/expiry.
- `/ai/continuity/refresh` is gated to Pro+ (`requirePlan('pro')`).
- Daily generation limits: Free `5/day`, Pro `50/day`, Premium `unlimited`.
- Transcript export tiers: Free `TXT`, Pro `TXT+PDF`, Premium `TXT+PDF+DOCX`.
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
