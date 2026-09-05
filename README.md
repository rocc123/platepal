# Plate Pal

Personal protein + fiber tracker for two people. Snap a meal photo or type a note, edit the estimate, and save it. Protein and fiber are the main numbers. Calories stay in the background.

This repo follows `PLAN.md`.

## Run locally

```bash
npm install
npm run dev
```

The Vite app listens on [http://127.0.0.1:4521](http://127.0.0.1:4521).

With no Supabase keys, the app runs in **local mode**: any email signs you in on this device, and meals stay in the browser. Two people can use different emails on the same phone or computer. Analyze will open the editor so you can type numbers by hand.

## Supabase (shared data + AI)

1. Copy `.env.example` to `.env` and add:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

2. In the Supabase project, run `supabase/migrations/0001_init.sql`.
3. Turn on email magic link. Google OAuth is optional. Add the Vite origin and the production host to Site URL + Redirect URLs.
4. Deploy the `analyze` Edge Function and set secrets:

```
supabase functions deploy analyze
supabase secrets set GEMINI_API_KEY=...
supabase secrets set GEMINI_MODEL=gemini-2.5-flash
```

The Gemini key never ships to the browser. Photos are resized on the device and are not stored.

## What is in v1

- Sign in (magic link, optional Google, or local email)
- Today: protein bar, fiber bar, meals for the local calendar day
- Add / edit / delete meals
- Analyze a photo or note (or enter a meal by hand)
- Saved meal templates
- Settings for name and goals
- Basic PWA shell (Add to Home Screen)

## Out of scope

Barcode lookup, photo storage, sharing meals, coaching, charts, and household dashboards. See `PLAN.md`.
