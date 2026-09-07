# Plate Pal

Personal protein + fiber tracker. Snap a meal photo or type a note, edit the estimate, and save it. Protein and fiber are the main numbers. Calories stay in the background.

This repo follows `PLAN.md`. Meal sources and breakfast/lunch/dinner/snack live in lookup tables. `eaten_at` is stored in UTC with the app timezone name and offset (Luxon).

Clone from GitHub:

```bash
git clone https://github.com/rocc123/platepal.git
cd platepal
```

## Run locally

```bash
npm install
npm run dev
```

The Vite app listens on [http://127.0.0.1:4521](http://127.0.0.1:4521).

With no Supabase keys, the app runs in **local mode**: any email signs you in on this device, and meals stay in the browser. Two people can use different emails on the same phone or computer. Analyze will open the editor so you can type numbers by hand.

## Supabase (shared data + AI)

Step-by-step production deploy (existing Supabase project → SQL → auth → Edge Function → Vercel) is in **[DEPLOY.md](DEPLOY.md)**.

Short version for local use against that project:

1. Copy `.env.example` to `.env` and add the Project URL plus the publishable (or legacy anon) key:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

2. In the Supabase SQL Editor, run `supabase/migrations/0001_init.sql`, then `0002_lookups_and_timezone.sql`.
3. Turn on the Email provider. Add `http://127.0.0.1:4521` to Site URL + Redirect URLs.
4. Deploy the `analyze` Edge Function and set secrets (Gemini key stays on Supabase, never in Vercel):

```
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase functions deploy analyze
npx supabase secrets set GEMINI_API_KEY=...
npx supabase secrets set GEMINI_MODEL=gemini-2.5-flash
```

Photos are resized on the device and are not stored.

## Deploy

Two pieces: **Supabase** (database, login, Analyze) and the **website** (Vercel or Netlify). Follow **[DEPLOY.md](DEPLOY.md)** in order.

Vercel import: [github.com/rocc123/platepal](https://github.com/rocc123/platepal). Framework Vite, build `npm run build`, output `dist`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then redeploy if you change them — Vite bakes those in at build time.

Netlify works too: same `dist` output, and `public/_redirects` is already in the repo for SPA routes.

## What is in v1

- Sign in (magic link, optional Google, or local email)
- Today: protein bar, fiber bar, meals for the local calendar day
- Add / edit / delete meals
- Analyze a photo or note (or enter a meal by hand)
- Saved meal templates
- Settings for name and goals
- Basic PWA shell (Add to Home Screen)
- USDA food search and Open Food Facts barcodes
- Multi-day protein/fiber charts

Food search uses the USDA FoodData Central `DEMO_KEY` unless you set `VITE_USDA_API_KEY` (free at [api.data.gov](https://api.data.gov/signup/)). Barcodes go to Open Food Facts. Neither key belongs in Supabase secrets.

## Out of scope

Photo storage, sharing meals, coaching, and household dashboards. See `PLAN.md`.
