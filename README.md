<p align="center">
  <img src="assets/logo.png" alt="Perut Tracker" width="440" />
</p>

# Perut Tracker

A tiny shared weight & lingkar perut (waist) tracker for Ahmad, Ian — and any
friend who wants to join. It's a static page (perfect for GitHub Pages) with a
shared timeline graph: everyone enters their name once, then hits the big
**"Share my progress"** button to log weight (kg) and lingkar perut (cm).
Everyone sees everyone's lines on the same graphs.

## How it works

- **Frontend:** one static `index.html` (Chart.js for the timeline graphs),
  hosted free on GitHub Pages.
- **Database:** [Supabase](https://supabase.com) free tier — a hosted Postgres
  with a REST API that the page talks to directly from the browser. Free tier
  is far more than enough for this (500 MB database, unlimited API requests).
- **Identity:** no passwords. On first visit you type your name (e.g. "Ahmad"
  or "Ian"); it's remembered in your browser. The database is general — a
  `users` table plus a `measurements` table — so any number of people can join
  later without changing anything.

Until the database is configured, the page runs in **demo mode**: entries are
saved only in your own browser so you can try it out, but they are not shared.

## Setup (one time, ~5 minutes)

### 1. Create the free database

1. Go to [supabase.com](https://supabase.com), sign in with GitHub, and create
   a new project (free plan). Pick any name/region/password.
2. In the project, open **SQL Editor → New query**, paste the contents of
   [`setup.sql`](setup.sql), and click **Run**. This creates the two tables and
   the security rules (anyone with the page can read and add entries, but
   nobody can edit or delete history).
3. Open **Project Settings → API** and copy two values:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon public** key (a long string — it is *meant* to be public; the
     security rules from `setup.sql` are what protect the data)

### 2. Point the page at the database

Edit [`config.js`](config.js) (you can do it right in the GitHub web editor)
and fill in the two values:

```js
window.PERUT_CONFIG = {
  supabaseUrl: "https://xxxx.supabase.co",
  supabaseAnonKey: "eyJ...",
};
```

Commit — the page redeploys automatically.

### 3. Enable GitHub Pages

In this repo: **Settings → Pages → Build and deployment → Source: GitHub
Actions**. The included workflow
([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) publishes the
site on every push. Your page will be at:

```
https://ahmadfarisfs.github.io/perut/
```

Send that link to Ian — that's it. He opens it, types "Ian", and starts
sharing.

## Database schema

Designed to be general so more people can join later:

| table | columns |
|---|---|
| `users` | `id`, `name` (display), `name_key` (lowercased, unique — the identity), `height_cm`, `birth_date`, `created_at` |
| `measurements` | `id`, `user_id → users.id`, `weight_kg`, `waist_cm`, `measured_at`, `created_at` |

Height and birth date are optional profile fields, editable anytime via
"edit profile" next to your name (a trigger still freezes names, so the
public key can never rename anyone). They unlock the derived statistics on
the dashboard — BMI with Asian-Pacific categories and your healthy weight
range, waist-to-height ratio (target < 0.50), weekly pace with a forecast
date for reaching healthy BMI, 30-day consistency, and combined crew stats —
and every stat recalculates automatically when the profile changes.

Either metric can be left empty on a check-in (but not both). Row Level
Security allows the public key to **read and insert only** — no updates or
deletes — so shared history can't be wiped by anyone who has the page URL.

## Daily reminders — push notifications (optional)

If someone hasn't checked in for 5 days, the app can send their devices a
push notification ("sudah 5 hari tanpa check-in…"). A scheduled GitHub
Actions job ([`reminders.yml`](.github/workflows/reminders.yml), 08:00 WIB
daily) checks Supabase and pushes via
[`scripts/send-reminders.mjs`](scripts/send-reminders.mjs).

**Until you finish this setup everything stays dormant and green** — the
in-app button is hidden and the scheduled job skips with a notice. It turns
itself on automatically once the pieces below exist:

1. Run the `push_subscriptions` block at the bottom of
   [`setup.sql`](setup.sql) in the Supabase SQL editor (just that block if
   you ran the rest earlier).
2. Generate a VAPID keypair: `npx web-push generate-vapid-keys`.
   Paste the **public** key into `config.js` → `vapidPublicKey`.
3. Add two repository secrets (Settings → Secrets and variables → Actions):
   - `VAPID_PRIVATE_KEY` — the private key from step 2
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase → Project Settings → API →
     `service_role` (secret) key. Never put this one in `config.js`.
4. Everyone opens the app and taps **Enable daily reminders** (allow
   notifications). iPhone note: iOS requires the app to be installed via
   Share → Add to Home Screen first (iOS 16.4+).

To test without waiting for the schedule: Actions → "Daily check-in
reminders" → Run workflow.

## Brand assets

Everything lives in [`assets/`](assets/): `mark.svg` (icon, source of truth),
`logo.png` (horizontal lockup, transparent), `favicon.svg`,
`apple-touch-icon.png`, `icon-192.png` / `icon-512.png` (PWA icons via
`site.webmanifest`), and `og.png` (social share card). Brand colors: volt
`#c9f31d` on near-black `#0c0c0b`, white `#ffffff` for primary text.

## Other free database options considered

- **Firebase (Firestore/Realtime DB):** also free and works, but security
  rules are fiddlier and it's Google-account-centric.
- **GitHub repo as database:** free but writes need a token with repo access —
  unsafe to embed in a public page.
- **localStorage only:** free and zero-setup, but data can't be shared between
  people — kept as the demo-mode fallback.

Supabase gives a real Postgres, painless row-level security, and a JS client
that works from a static page — the best fit here.
