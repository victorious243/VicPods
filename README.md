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
- Plan gating middleware (`requirePlan`) and free AI daily limit (5/day)

## Tech
- Node.js
- Express
- EJS
- MongoDB + Mongoose
- dotenv

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create environment file:
   ```bash
   cp .env.example .env
   ```
3. Start MongoDB locally (default URI uses `127.0.0.1:27017`).
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
```

If `AI_PROVIDER=openai` but `OPENAI_API_KEY` is empty, VicPods automatically falls back to deterministic mock AI output.

## Key Routes
- Auth: `/auth/register`, `/auth/login`, `/auth/logout`
- Studio: `/studio`
- Kitchen: `/kitchen`, `/kitchen/:seriesId`, `/kitchen/:seriesId/themes/:themeId/episodes/:episodeId`
- Transcript: `POST /kitchen/:seriesId/themes/:themeId/episodes/:episodeId/transcript/generate`, `GET /kitchen/:seriesId/themes/:themeId/episodes/:episodeId/transcript/download?format=pdf|docx|txt`
- Pantry: `/pantry`
- AI: `/ai/episode/generate`, `/ai/spices/generate`, `/ai/continuity/refresh`
- Billing: `/billing`

## Notes
- `/ai/continuity/refresh` is gated to Pro+ (`requirePlan('pro')`) to demonstrate premium endpoint architecture.
- Free plan generation actions (AI + transcript generation) are capped at 5/day.
- Legacy series episodes are auto-migrated into a `General` theme when first opened.
