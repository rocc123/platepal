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

1. Copy `.env.example` to `.env` and add:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

2. In the Supabase project, run `supabase/migrations/0001_init.sql`, then `0002_lookups_and_timezone.sql`, then `0003_meal_duration.sql`, then `0004_portion_units.sql`, then `0005_meal_name.sql`.
3. Turn on email OTP. **Confirm email** should be off — the code is the confirmation. The app must send `emailRedirectTo` (it uses `/login`) or Supabase does not send mail. The Magic Link and Confirm signup templates must use `{{ .Token }}` (a code), not `{{ .ConfirmationURL }}` (a link). Home screen apps cannot sign in from an email link. Add the Vite origin, `/login`, and the production host to Site URL + Redirect URLs. Outlook and Hotmail often put the default Supabase mailer in Junk — custom SMTP helps if codes never arrive.
4. Deploy the `analyze` Edge Function and set secrets:

```
supabase functions deploy analyze
supabase secrets set GEMINI_API_KEY=...
supabase secrets set GEMINI_MODEL=gemini-3.5-flash-lite
```

The Gemini key never ships to the browser. Photos are resized on the device and are not stored.

## Secrets on Cloud Agents

Running the app on a Cursor Cloud Agent needs no secrets: with none set it starts in **local mode** (see above). Secrets only unlock the optional Supabase + AI features.

Add secrets in the **Secrets** panel next to the agent chat. They are injected as environment variables into **new** agent VMs (not the currently running one), so set them, then start a fresh agent or restart the `dev` terminal.

Only the browser/build-time vars belong here. Vite bakes any `VITE_`-prefixed variable into the client bundle at build/startup, so setting them in the panel is enough — no `.env` file needed:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_USDA_API_KEY` (optional; falls back to USDA `DEMO_KEY`)

Because `VITE_` values ship to the browser, they are not private. That is fine for the Supabase anon key and USDA key, which are meant to be public. Never put a sensitive key (like `GEMINI_API_KEY`) behind a `VITE_` name.

Server-side secrets for the `analyze` function (`GEMINI_API_KEY`, `GEMINI_MODEL`) are **not** Cloud Agent secrets — set them in Supabase with `supabase secrets set` as shown above.

## Deploy (Vercel frontend + Supabase Postgres)

Recommended path: create the website and the Postgres project from Vercel so billing and env vars stay in one place.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Frocc123%2Fplatepal&project-name=plate-pal&repository-name=platepal&stores=%5B%7B%22type%22%3A%22integration%22%2C%22integrationSlug%22%3A%22supabase%22%2C%22productSlug%22%3A%22supabase%22%2C%22protocol%22%3A%22storage%22%2C%22allowConnectExistingProduct%22%3Atrue%7D%5D)

Or do it from an existing clone:

1. Import [github.com/rocc123/platepal](https://github.com/rocc123/platepal) at [vercel.com/new](https://vercel.com/new). Framework **Vite**, build `npm run build`, output `dist`.
2. In the Vercel project: **Storage → Create Database → Supabase** (or `npx vercel integration add supabase` after `npx vercel link`).
3. Marketplace syncs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The Vite build maps those onto the client automatically. Redeploy after the database is connected — Vite bakes public keys in at **build** time.
4. Open **Supabase Studio** from the Vercel Storage page. In the SQL Editor, run `supabase/migrations/0001_init.sql`, then `0002_lookups_and_timezone.sql`, then `0003_meal_duration.sql`, then `0004_portion_units.sql`, then `0005_meal_name.sql`.
5. **Authentication → Providers → Email**: leave magic link / OTP on. Turn **Confirm email** off so the first email is the code, not a confirm-then-code dance.
6. **Authentication → Email Templates → Magic Link** and **Confirm signup**: use `{{ .Token }}` only. Do not include `{{ .ConfirmationURL }}`. The app still sends a redirect URL so Supabase will mail the message; the template is what makes it a typed code. Email links open in the browser and will not sign the installed PWA in. The live templates are in `supabase/templates/`.
7. **Authentication → URL Configuration**:
   - Site URL: `https://your-app.vercel.app`
   - Redirect URLs: that origin, `https://your-app.vercel.app/login`, plus `http://127.0.0.1:4521` and `http://127.0.0.1:4521/login` for local.

### Analyze function (optional until login works)

Gemini stays on Supabase. Never put `GEMINI_API_KEY` or the service-role / secret key in Vercel.

```bash
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase functions deploy analyze
npx supabase secrets set GEMINI_API_KEY=your-gemini-key
npx supabase secrets set GEMINI_MODEL=gemini-3.5-flash-lite
```

The project ref is in **Project Settings → General**.

CLI deploy of the website (after `npx vercel login`):

```bash
npx vercel --prod
```

Netlify works too: same `dist` output, and `public/_redirects` is already in the repo for SPA routes. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` there yourself.

## What is in v1

- Sign in (email code, or local email when Supabase keys are missing)
- Today: protein bar, fiber bar, current fast, a 24-hour eating/fasting bar, meals for the local calendar day
- Add / edit / delete meals, with a 15-minute eating duration so fasting starts when the meal ends
- Analyze a photo or note (or enter a meal by hand). Photos of plates and recipes are named as a dish, not a grocery list.
- Saved meal templates
- Settings for name and goals
- Basic PWA shell (Add to Home Screen)
- USDA food search and barcodes (USDA branded labels, then Open Food Facts)
- Multi-day protein/fiber charts and a week of 24-hour eating/fasting bars

Food search uses the USDA FoodData Central `DEMO_KEY` unless you set `VITE_USDA_API_KEY` (free at [api.data.gov](https://api.data.gov/signup/)). Barcodes check the USDA branded-food label first (it is the manufacturer's own panel) and fall back to Open Food Facts. Live scan and barcode photos work in the installed PWA (Safari and Chrome) with a JavaScript decoder; you can still type the number. Neither key belongs in Supabase secrets.

## Out of scope

Photo storage, sharing meals, coaching, and household dashboards. See `PLAN.md`.
