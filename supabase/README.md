# Supabase setup for shared donations

Run this once in the Supabase SQL Editor (Dashboard → SQL → New query):

1. Open [`schema.sql`](./schema.sql)
2. Paste the full file and click **Run**

## Tables

| Table | Purpose |
|-------|---------|
| `donation_entries` | Client donation amount, date, note per organization |
| `advisor_export_items` | Advisor export list, amounts, notes, inclusion, address overrides |
| `client_activity_log` | Admin visibility into client changes |

## Environment variables

**Vercel API service** (required for shared data):

- `SUPABASE_URL` — Project URL from Supabase Settings → API
- `SUPABASE_SERVICE_ROLE_KEY` — service_role key (server only, never in browser)

**Vercel frontend** (optional, for future browser auth):

- `VITE_SUPABASE_URL` — same project URL
- `VITE_SUPABASE_ANON_KEY` — anon public key

## Verify

After redeploying the API:

```text
GET https://donation-rank-project.vercel.app/api/shared-data/status
```

Expected: `{ "sharedDataEnabled": true, ... }`

## Security

The app currently writes to Supabase through the Express API using the service role key. Before storing real private client data in production, enable Supabase Auth and Row Level Security. See comments at the bottom of `schema.sql`.
