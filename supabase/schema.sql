create extension if not exists "pgcrypto";

create table if not exists donation_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  organization_name text not null default '',
  donation_amount numeric not null check (donation_amount > 0),
  donation_date date not null,
  donation_year integer generated always as (extract(year from donation_date)::integer) stored,
  note text not null default '',
  created_by text not null default 'client',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists donation_entries_organization_id_idx on donation_entries (organization_id);
create index if not exists donation_entries_donation_date_idx on donation_entries (donation_date desc);

create table if not exists advisor_export_items (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null unique,
  organization_name text not null default '',
  donation_amount numeric,
  notes text not null default '',
  include_in_export boolean not null default true,
  details_json jsonb not null default '{}'::jsonb,
  sent_to_advisor_at timestamptz,
  created_by text not null default 'client',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists advisor_export_items_include_idx on advisor_export_items (include_in_export);

create table if not exists client_activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null default 'client',
  actor_name text not null default 'client',
  action_type text not null,
  organization_id text,
  organization_name text,
  old_value_json jsonb,
  new_value_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists client_activity_log_created_at_idx on client_activity_log (created_at desc);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists donation_entries_set_updated_at on donation_entries;
create trigger donation_entries_set_updated_at
before update on donation_entries
for each row execute function set_updated_at();

drop trigger if exists advisor_export_items_set_updated_at on advisor_export_items;
create trigger advisor_export_items_set_updated_at
before update on advisor_export_items
for each row execute function set_updated_at();

-- Security (required before real client data):
-- Enable Supabase Auth and Row Level Security before production use with private donation data.
-- Example policies (adjust after auth roles exist):
--   client role: insert/update/delete on donation_entries, advisor_export_items; insert on client_activity_log
--   admin role: select all rows on donation_entries, advisor_export_items, client_activity_log
-- Until RLS is enabled, the API uses SUPABASE_SERVICE_ROLE_KEY server-side only (never expose in the browser).
