# Plate Pal

Personal protein + fiber tracker. Snap a meal photo or type a note, edit the estimate, and save it. Protein and fiber are the main numbers. Calories stay in the background.

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

## Deploy

There are two pieces: the website (Vercel or Netlify) and the Analyze function (Supabase). Do the website first.

### 1. Website on Vercel

From the project folder (PowerShell is fine):

```bash
npx vercel login
npx vercel
```

When it asks, set:

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`

Then add env vars in the Vercel project (**Settings → Environment Variables**), or at the prompt:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

Vite bakes those in at build time. After you add or change them, redeploy:

```bash
npx vercel --prod
```

That prints a URL like `https://plate-pal-xxx.vercel.app`.

### 2. Tell Supabase about that URL

In Supabase: **Authentication → URL Configuration**.

- Site URL: `https://your-vercel-url.vercel.app`
- Redirect URLs: add that same origin (and keep `http://127.0.0.1:4521` for local).

### 3. Analyze function (optional until login works)

In WSL, from this repo:

```bash
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase functions deploy analyze
npx supabase secrets set GEMINI_API_KEY=your-gemini-key
npx supabase secrets set GEMINI_MODEL=gemini-2.5-flash
```

The project ref is in **Project Settings → General**. Use your Gemini key here, not in Vercel.

Netlify works too: same `dist` output, and `public/_redirects` is already in the repo for SPA routes.

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
