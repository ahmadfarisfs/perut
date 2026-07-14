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

-- ── Profile: height & birth date ─────────────────────────────────────────────
-- If you already ran the tables above, you can run just this block — it is
-- idempotent, and re-running it also upgrades an older fill-once version.
-- Both fields are optional and editable from the app's "edit profile". The
-- trigger freezes name/name_key, so the public anon key can never rename
-- anyone even though updates are allowed.

alter table public.users
  add column if not exists height_cm  numeric(4,1) check (height_cm > 50 and height_cm < 300),
  add column if not exists birth_date date check (birth_date > '1900-01-01');

create or replace function public.protect_user_profile() returns trigger
language plpgsql as $$
begin
  new.name := old.name;
  new.name_key := old.name_key;
  new.created_at := old.created_at;
  return new;
end $$;

drop trigger if exists protect_user_profile on public.users;
create trigger protect_user_profile before update on public.users
  for each row execute function public.protect_user_profile();

drop policy if exists "anyone can complete their profile" on public.users;
create policy "anyone can complete their profile"
  on public.users for update using (true) with check (true);

-- ── Push reminders (optional feature) ────────────────────────────────────────
-- If you already ran the tables above, you can run just this block.
-- Devices register here when a user taps "Enable daily reminders". The anon
-- key may only INSERT: endpoints are capability URLs, so nobody may read or
-- delete them with the public key. The daily reminder job (GitHub Actions)
-- reads and prunes them with the service_role key, which bypasses RLS.

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "anyone can enable reminders" on public.push_subscriptions;
create policy "anyone can enable reminders"
  on public.push_subscriptions for insert with check (true);
