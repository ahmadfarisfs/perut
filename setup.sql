-- ── Perut Tracker database setup (Supabase / Postgres) ───────────────────────
-- Run this once in your Supabase project: SQL Editor → New query → paste → Run.
--
-- Design notes:
--   * `users` is general: anyone can join by entering a name on first visit
--     (Ahmad and Ian today, more friends later — no schema change needed).
--   * `measurements` stores one check-in per row. Both metrics are nullable so
--     you can log only weight or only lingkar perut, but at least one is
--     required (enforced by a CHECK constraint).
--   * Row Level Security allows the public (anon) key to read everything and
--     insert new rows, but never update or delete — so shared history can't be
--     wiped by anyone holding the public key.

create table if not exists public.users (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,                -- display name, e.g. "Ahmad"
  name_key   text not null unique,         -- lowercased name, used as identity
  created_at timestamptz not null default now()
);

create table if not exists public.measurements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  weight_kg   numeric(5, 2) check (weight_kg  > 0 and weight_kg  < 500),
  waist_cm    numeric(5, 2) check (waist_cm   > 0 and waist_cm   < 500),
  measured_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  constraint at_least_one_metric check (weight_kg is not null or waist_cm is not null)
);

create index if not exists measurements_user_time_idx
  on public.measurements (user_id, measured_at);

-- Row Level Security: everyone with the anon key may read and add, never edit.
alter table public.users        enable row level security;
alter table public.measurements enable row level security;

create policy "anyone can read users"
  on public.users for select using (true);

create policy "anyone can join"
  on public.users for insert with check (true);

create policy "anyone can read measurements"
  on public.measurements for select using (true);

create policy "anyone can share progress"
  on public.measurements for insert with check (true);
