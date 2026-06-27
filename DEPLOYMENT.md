# Deployment

## Live URLs

| Service | URL |
|---------|-----|
| **Client app (production)** | https://donation-rank-project.vercel.app |
| **API health check** | https://donation-rank-project.vercel.app/api/health |

The project is deployed on **Vercel** with:

- React client (static `dist/`)
- Express API (`server/`) as a Vercel web service on the same domain (`/api/*`)

`VITE_API_BASE_URL` defaults to `/api`, so no separate API URL env var is required for this setup.

`vercel.json` defines two services: `frontend` at `/` and `donation-rank-api` at `/api`. Do not set the API `routePrefix` to `/` — that causes "Cannot GET /" because Express takes over the homepage.

## Vercel project

- **Project:** `donation-rank-project`
- **Team:** `mikas-projects-336dbc3c`
- **GitHub:** connected to `Mika-Garber/donation-rank-project`
- **Config:** `vercel.json`

### Environment variables (Vercel dashboard)

| Name | Production value | Purpose |
|------|------------------|---------|
| `VITE_SHOW_ADMIN_TOOLS` | `false` | Hides admin nav for client |
| `VITE_APP_ACCESS_TOKEN` | optional | Match `APP_ACCESS_TOKEN` on API if you add one |
| `VITE_API_BASE_URL` | optional | Defaults to `/api` on same domain |
| `VITE_SUPABASE_URL` | optional | Supabase project URL (for future browser auth; shared data uses API) |
| `VITE_SUPABASE_ANON_KEY` | optional | Supabase anon key (never use service role in the browser) |

On the **API service** (Vercel → donation-rank-api → Environment Variables):

| Name | Purpose |
|------|---------|
| `SUPABASE_URL` | Same as `VITE_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; enables shared donation/advisor persistence |

Redeploy after changing `VITE_*` variables (build-time). Redeploy the API service after changing `SUPABASE_*`.

### Redeploy from CLI

```bash
npm run vercel:link    # only needed once per machine (or if .vercel is missing)
npm run vercel:deploy
```

Or manually:

```bash
npx vercel link --yes --project donation-rank-project
npx vercel --prod
```

### `vercel link` troubleshooting

The project folder is named **Donation Rank Project** (with spaces). Vercel project names cannot contain spaces, so a plain `vercel link` may fail with:

> Project names must be lowercase… (400)

**Fix:** always pass the project name explicitly:

```bash
npx vercel link --yes --project donation-rank-project
```

The repo includes `.vercel/project.json` so linking should work automatically after you pull. If link still fails:

1. Run `npx vercel login`
2. Run `npm run vercel:link` from the project root
3. Confirm `.vercel/project.json` exists with `projectName: donation-rank-project`

## Client vs admin mode

| Mode | Setting | Nav |
|------|---------|-----|
| Local (`npm run dev`) | unset or `true` | Client pages + Admin Tools |
| Vercel production | `false` | Dashboard, Final 15–20 Plan, Advisor Export, How Ranking Works |

Client mode still allows donation amount/date editing and Advisor Export.

## Shared donations (Supabase)

Without Supabase, donation edits on Vercel are stored per server instance (ephemeral `/tmp`) or in browser localStorage for Advisor Export — client and admin will **not** see the same data.

To share donation and advisor export data between client and admin:

1. Create a [Supabase](https://supabase.com) project.
2. In Supabase SQL Editor, run the full script in [`supabase/schema.sql`](./supabase/schema.sql).
3. Copy **Project URL** and **service_role** key (Settings → API).
4. Set on the Vercel **API** service:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Optionally set on the **frontend** service (for future auth):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Redeploy both services.

Verify: `GET https://donation-rank-project.vercel.app/api/shared-data/status` should return `"sharedDataEnabled": true`.

Admin → **Client Activity** shows recent donation/advisor changes when Supabase is configured.

**Security:** The current implementation uses the service role on the server only. Before storing real private client data in production, enable Supabase Auth + Row Level Security (see comments in `supabase/schema.sql`).

Admin routes (`/data-refresh`, `/organizations/new`, etc.) show a blocked message in client mode.

## Local development

```bash
npm run dev:all
```

- Frontend: http://localhost:5173
- API: http://localhost:4000/api/health

`.env` (root):

```env
VITE_API_BASE_URL=/api
VITE_SHOW_ADMIN_TOOLS=true
```

## Optional: API on Render instead

If you prefer a separate API host with a traditional persistent disk (recommended if client donation edits must survive redeploys), use `render.yaml`:

1. Push `render.yaml` to GitHub.
2. Render → **New Blueprint** → connect repo.
3. Set `APP_ACCESS_TOKEN` and `CHARITY_NAVIGATOR_API_KEY` on Render.
4. On Vercel, set `VITE_API_BASE_URL=https://your-service.onrender.com/api`.
5. Remove `experimentalServices` from `vercel.json` and redeploy the frontend only.

## Security

- Set `APP_ACCESS_TOKEN` on the API service and matching `VITE_APP_ACCESS_TOKEN` on the frontend for production.
- Hiding admin tools in the UI is not authentication — it only controls navigation.

## Adding new charities

New charities should be added in the local admin version and redeployed, or via the API directly.
