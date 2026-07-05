# 💪 Perut Tracker

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
| `users` | `id`, `name` (display), `name_key` (lowercased, unique — the identity), `created_at` |
| `measurements` | `id`, `user_id → users.id`, `weight_kg`, `waist_cm`, `measured_at`, `created_at` |

Either metric can be left empty on a check-in (but not both). Row Level
Security allows the public key to **read and insert only** — no updates or
deletes — so shared history can't be wiped by anyone who has the page URL.

## Other free database options considered

- **Firebase (Firestore/Realtime DB):** also free and works, but security
  rules are fiddlier and it's Google-account-centric.
- **GitHub repo as database:** free but writes need a token with repo access —
  unsafe to embed in a public page.
- **localStorage only:** free and zero-setup, but data can't be shared between
  people — kept as the demo-mode fallback.

Supabase gives a real Postgres, painless row-level security, and a JS client
that works from a static page — the best fit here.
