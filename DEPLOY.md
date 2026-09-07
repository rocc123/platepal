# Deploy Plate Pal

Plate Pal is two deployments that talk to each other:

1. **Supabase** — database, login, and the `analyze` Edge Function (Gemini).
2. **Website** — the Vite React app on Vercel (or Netlify).

You already have a Supabase project. Work through the steps in order. You do **not** need Docker for this production deploy.

**Never put these in Vercel, Netlify, or GitHub:** `GEMINI_API_KEY`, the Supabase `service_role` / secret key, or the database password. Only the public project URL and the anon/publishable key go in the website.

---

## What you will need

- This repo, cloned locally: [github.com/rocc123/platepal](https://github.com/rocc123/platepal)
- Your existing [Supabase](https://supabase.com/dashboard) project
- A free [Vercel](https://vercel.com) account (or Netlify)
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey) (only if you want photo/note estimates)

Node 20+ is enough for the CLI commands. PowerShell, macOS Terminal, or WSL all work.

---

## Step 1 — Copy the project URL and public key

1. Open your project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Click **Connect** (top of the project), or go to **Project Settings → API Keys**.
3. Copy:
   - **Project URL** — looks like `https://abcdefghijklmnop.supabase.co`
   - **Publishable key** — starts with `sb_publishable_...`  
     If the project still shows **Legacy API Keys**, the `anon` key works the same. Paste whichever you copy into `VITE_SUPABASE_ANON_KEY`.
4. On **Project Settings → General**, copy the **Reference ID** (short string). You will use it to link the CLI.

Do **not** copy the `service_role` or secret key. That key bypasses row-level security.

---

## Step 2 — Create the database tables

The app needs both SQL files, in this order:

1. `supabase/migrations/0001_init.sql` — profiles, meals, meal items, saved meals, RLS, auto-create profile
2. `supabase/migrations/0002_lookups_and_timezone.sql` — meal sources, breakfast/lunch/dinner/snack, timezone columns

### Dashboard (simplest)

1. In the Supabase sidebar, open **SQL Editor**.
2. **New query**.
3. Paste the entire contents of `supabase/migrations/0001_init.sql`.
4. Click **Run**. It should succeed with no error.
5. **New query** again.
6. Paste the entire contents of `supabase/migrations/0002_lookups_and_timezone.sql`.
7. Click **Run**.

If `0001` says a table already exists, this project was already initialized. Skip to `0002`. If `0002` says a column already exists, you are done.

### CLI instead

From the repo root:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

`YOUR_PROJECT_REF` is the Reference ID from Step 1. The CLI will ask for the database password (set when you created the project; reset it under **Project Settings → Database** if you lost it).

---

## Step 3 — Turn on email magic-link login

1. Open **Authentication → Providers** (sometimes labeled **Sign In / Providers**).
2. Open **Email**.
3. Make sure **Enable Email provider** is on.
4. Leave magic links / OTP enabled. Plate Pal calls `signInWithOtp` and emails a sign-in link.
5. Save.

On the free plan, Supabase sends mail for you. Rate limits are low, which is fine for two people. Check spam if a link does not arrive.

Google is optional. Skip it until login by email works. See [Optional: Google](#optional-google-sign-in) at the bottom.

---

## Step 4 — Allow the app origin in Auth

1. Open **Authentication → URL Configuration**.
2. Set **Site URL** to `http://127.0.0.1:4521` for now. You will change this to the Vercel URL in Step 8.
3. Under **Redirect URLs**, add each of these as its own entry:

```
http://127.0.0.1:4521
http://127.0.0.1:4521/**
https://*-YOUR_VERCEL_TEAM.vercel.app/**
```

Replace `YOUR_VERCEL_TEAM` after you know the Vercel URL, or add the exact production origin in Step 8.

Plate Pal sends `emailRedirectTo: window.location.origin`, so the origin that served the login page must be on this list or the magic link will land on the wrong host.

---

## Step 5 — Deploy the `analyze` Edge Function

This is the only piece that talks to Gemini. The browser never sees the Gemini key.

From the repo root (same login/link as Step 2 is fine):

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy analyze
```

Confirm it in the dashboard: **Edge Functions** should list `analyze`.

Get a Gemini key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey), then set secrets:

```bash
npx supabase secrets set GEMINI_API_KEY=your-gemini-key
npx supabase secrets set GEMINI_MODEL=gemini-2.5-flash
```

You can also add those under **Edge Functions → Secrets** (or **Project Settings → Edge Functions**). You do **not** need to redeploy after setting secrets.

If `gemini-2.5-flash` is unavailable in AI Studio, use the current cheap Flash-class vision model and set `GEMINI_MODEL` to that ID.

Without this function, the rest of the app still works. Analyze will fail until the function and `GEMINI_API_KEY` exist; you can type protein and fiber by hand.

---

## Step 6 — Point the website at Supabase (local smoke test)

In the repo:

```bash
cp .env.example .env
```

Edit `.env`:

```
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:4521](http://127.0.0.1:4521). You should **not** see the “Running locally without Supabase” banner. Sign in with your email, open the link, and confirm a profile row appears in **Table Editor → profiles**.

---

## Step 7 — Deploy the website to Vercel

1. Push this repo to GitHub if it is not already there.
2. Go to [vercel.com/new](https://vercel.com/new) and **Import** [github.com/rocc123/platepal](https://github.com/rocc123/platepal).
3. Framework Preset: **Vite**.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Before you deploy, add environment variables (**Environment Variables**):

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://YOUR_PROJECT_REF.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | the same publishable or anon key as `.env` |

Apply them to Production (and Preview if you want preview deploys to log in).

7. Deploy.

Vite bakes `VITE_*` into the JS bundle at **build** time. If you add or change these vars later, trigger a **Redeploy** (or `npx vercel --prod`). Restarting the deployment without rebuilding is not enough.

From the project folder you can also deploy with the CLI:

```bash
npx vercel login
npx vercel
npx vercel --prod
```

Copy the production URL, for example `https://plate-pal-xxx.vercel.app`.

### Netlify instead

Same `dist` output. The repo already has `public/_redirects` for SPA routes. Add the same two `VITE_*` environment variables and redeploy after changing them.

---

## Step 8 — Point Supabase at the live site

Back in **Authentication → URL Configuration**:

1. **Site URL** = your production origin, for example `https://plate-pal-xxx.vercel.app` (no trailing slash).
2. **Redirect URLs** — add that same origin, and keep local:

```
https://plate-pal-xxx.vercel.app
https://plate-pal-xxx.vercel.app/**
http://127.0.0.1:4521
http://127.0.0.1:4521/**
```

If you use a custom domain later, add that origin too and make it the Site URL.

---

## Step 9 — Check that it works

On the Vercel URL:

1. Sign in with email. The magic link should open the **live** site, not localhost.
2. Settings: set a name and protein/fiber goals. Reload — they should stick.
3. Add a meal by hand. Today’s bars should move.
4. Add a meal from a photo or note and tap Analyze. You should get editable items (not a “not configured” message).
5. Sign out, sign in as a second person. They must not see the first person’s meals.

---

## Optional: Google sign-in

Do this after email login already works.

1. In Supabase: **Authentication → Providers → Google**. Copy the **Callback URL** (`https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`).
2. In [Google Cloud Console](https://console.cloud.google.com/) → **Google Auth Platform → Clients**, create a **Web application** OAuth client.
3. Authorized JavaScript origins: your Vercel origin and `http://127.0.0.1:4521`.
4. Authorized redirect URIs: the Supabase callback URL from step 1.
5. Paste the Client ID and Client Secret into the Supabase Google provider page and enable it.
6. Confirm those same origins are in **Authentication → URL Configuration**.

Until this is done, **Continue with Google** on the login page will error. Email still works.

---

## Optional: USDA food search

Food search uses USDA’s `DEMO_KEY` unless you set `VITE_USDA_API_KEY` (free at [api.data.gov/signup](https://api.data.gov/signup/)). Put that in Vercel the same way as the Supabase vars, then redeploy. Do **not** put it in Supabase secrets. Barcodes use Open Food Facts and need no key.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Banner: “Running locally without Supabase” | `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are empty. For Vercel, add them and **redeploy**. |
| Magic link opens localhost | Site URL / Redirect URLs still point at `127.0.0.1`. Step 8. |
| Login works, meals/settings fail | Migration `0001` or `0002` was not run. Step 2. |
| `meal_sources` / `source_id` errors | `0002_lookups_and_timezone.sql` was skipped. |
| Analyze: missing authorization / invalid session | Sign in again. The function requires a logged-in user. |
| Analyze: `GEMINI_API_KEY is not set` | Step 5 secrets. No Vercel restart needed; retry Analyze. |
| Analyze: Gemini request failed | Wrong model ID or key. Confirm the model in AI Studio and `GEMINI_MODEL`. |
| No email arrives | Spam folder; wait a minute; free-tier mail is rate-limited. |
| Google button errors | Provider not configured. Use email, or finish the Google section. |

---

## What talks to what

```
Phone / laptop
    → Vercel static app (VITE_SUPABASE_URL + anon/publishable key)
        → Supabase Auth (magic link / Google)
        → Supabase Postgres (RLS: each user only sees their rows)
        → Edge Function `analyze` (user JWT)
            → Gemini (GEMINI_API_KEY stays on Supabase)
```
