# Stewardship Ranking Web App

Client-friendly stewardship ranking app for non-technical users.  
This app ranks organizations, explains each rank in plain English, and supports one-click online data refresh.

## What the app does

- Easy dashboard with top recommendations.
- Organization detail page with clear "Why this rank?" reasons.
- Add new donation organizations from a short form.
- Explain the scoring method in simple language.
- Manual "Update from online sources" button.

## Tech stack

- Frontend: Vite + React + TypeScript + Material UI + React Router + React Query + Zustand
- Backend: Node + Express + TypeScript
- Storage: JSON file seeded from existing donation CSV output; **client-editable donations and advisor export** use Supabase when configured
- Public-source enrichment: ProPublica Nonprofit Explorer search API

## Local setup

### 1) Install dependencies

From project root:

`npm install`

From server:

`cd server && npm install`

### 2) Optional environment setup

Copy these files if you want private token protection:

- `.env.example` -> `.env`
- `server/.env.example` -> `server/.env`

Set a shared token in both places:

- `VITE_APP_ACCESS_TOKEN=your-token`
- `APP_ACCESS_TOKEN=your-token`

For local admin tools (Add Organization, Research Audit, Data Refresh, etc.), set:

- `VITE_SHOW_ADMIN_TOOLS=true`

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Vercel client mode (`VITE_SHOW_ADMIN_TOOLS=false`) and Supabase shared donation setup.

Optional Supabase (shared client/admin donations):

- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in root `.env`
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` in `server/.env`
- Run `supabase/schema.sql` in your Supabase SQL editor

Without Supabase, local JSON + browser localStorage fallbacks still work for development.

### 3) Run the app

In one command from root:

`npm run dev:all`

- Frontend: [http://localhost:5173](http://localhost:5173)
- API: [http://localhost:4000/api/health](http://localhost:4000/api/health)

## API routes

- `GET /api/organizations` - list ranked organizations
- `GET /api/organizations/:id` - organization details
- `POST /api/organizations` - add organization
- `GET /api/ranking/explanation` - scoring explanation
- `GET /api/ranking/top?limit=10` - top recommendations
- `POST /api/refresh` - pull fresh public data
- `GET /api/refresh/status` - latest refresh summary

## Build commands

- Frontend: `npm run build`
- Backend: `npm run build:server`
- Both: `npm run build:all`

## Private hosting recommendations

Production client app: **https://donation-rank-project.vercel.app**

For a non-technical client, keep access protected:

- Set `APP_ACCESS_TOKEN` on the API service and matching `VITE_APP_ACCESS_TOKEN` on Vercel.
- `VITE_SHOW_ADMIN_TOOLS=false` is already set on Vercel production.
- Keep the URL private and share only with trusted family members.

Full deployment details: [DEPLOYMENT.md](./DEPLOYMENT.md).

## Notes

- The ranking engine is intentionally transparent and conservative.
- Missing data reduces confidence and shows "Needs Research" instead of overconfident rankings.
