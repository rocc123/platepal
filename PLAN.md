# Protein + Fiber Tracker — Cursor Implementation Plan

Personal nutrition app for two people (husband + wife). Snap a meal photo or type a note, get an estimate, edit it, save it. Track **protein and fiber** first. Calories and other macros are stored but not the hero metric.

Build this exactly. Do not add extra product surface (social, coaching chatbot, barcode v1, meal plans, ads).

---

## 0. How to use this file in Cursor

1. Put this file at the repo root as `PLAN.md`.
2. Create `.env.example` from the env section below.
3. Work in the phases in order. Finish a phase before starting the next.
4. After each phase, run the app and check the acceptance criteria.
5. Do not invent tables, routes, or pages that are not in this plan.

Suggested first Cursor prompt:

> Read PLAN.md. Scaffold the Vite + React + TypeScript app and the folder layout in section 4. Stop after the empty app runs. Do not add features yet.

---

## 1. Product

### Users
- Two logged-in people. Each sees only their own data.
- Mobile-first. Desktop must work.

### Core loop
1. Sign in.
2. See today: protein bar, fiber bar, meal list.
3. Add a meal:
   - take/pick a photo and/or type a short note
   - call analyze API
   - edit names, grams, protein, fiber, calories, carbs, fat
   - save
4. Optionally save the meal as a reusable template.
5. Edit goals in settings.

### Non-goals (do not build)
- Storing original photos in Supabase Storage
- Barcode / USDA / Open Food Facts (later)
- Sharing meals between users
- Native apps, HealthKit, widgets
- Calorie-deficit coaching, weight log, water log
- Teams, roles, admin panel

---

## 2. Stack (locked)

| Layer | Choice |
|---|---|
| UI | Vite + React + TypeScript |
| Routing | React Router |
| Styling | Plain CSS modules or one small CSS file. No Tailwind required. Keep it readable on a phone. |
| Auth + DB | Supabase (Postgres + Auth + RLS) |
| Client SDK | `@supabase/supabase-js` |
| Analyze API | Vite-friendly serverless function **or** a tiny Express/Node handler if using a simple host. Prefer **Supabase Edge Function** named `analyze` so one vendor holds secrets. |
| Vision model | Google Gemini Flash / Flash-Lite via official Gemini API |
| PWA | Add last (manifest + service worker). Not blocking v1. |
| Hosting | Vercel or Netlify for the static app is fine. Edge Function can live on Supabase. |

If you implement the analyze function as a Supabase Edge Function, the React app calls it with the user's access token.

---

## 3. Environment

`.env` (never commit real keys):

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Edge Function secrets (Supabase dashboard / `supabase secrets set`):

```
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.8-flash
```

Use whatever current Gemini Flash model ID is available in AI Studio if `gemini-3.8-flash` is renamed. Prefer the cheapest Flash-class vision model.

---

## 4. Repo layout

```
/
  PLAN.md
  package.json
  vite.config.ts
  index.html
  .env.example
  public/
    manifest.webmanifest          # phase 6
    icons/                        # phase 6
  src/
    main.tsx
    App.tsx
    vite-env.d.ts
    styles.css
    lib/
      supabase.ts
      types.ts
      dates.ts                    # local calendar day helpers
      analyze.ts                  # client wrapper for edge function
      totals.ts
    components/
      AuthGate.tsx
      GoalBar.tsx
      MealCard.tsx
      MealEditor.tsx
      PhotoPicker.tsx
    pages/
      LoginPage.tsx
      TodayPage.tsx
      AddMealPage.tsx
      EditMealPage.tsx
      SettingsPage.tsx
      SavedMealsPage.tsx
  supabase/
    migrations/
      0001_init.sql
    functions/
      analyze/
        index.ts
```

Keep components small. No Redux. React state + Supabase queries is enough.

---

## 5. Database

Run this as the first migration. Enable RLS on every table. No public policies that skip `auth.uid()`.

```sql
-- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  protein_goal_g numeric not null default 150,
  fiber_goal_g numeric not null default 30,
  calorie_goal numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- meals
create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  eaten_at timestamptz not null default now(),
  note text,
  source text not null check (source in ('photo', 'text', 'saved', 'manual')),
  calories numeric not null default 0,
  protein_g numeric not null default 0,
  fiber_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  confidence numeric,
  created_at timestamptz not null default now()
);

-- meal_items
create table public.meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals (id) on delete cascade,
  name text not null,
  grams numeric,
  calories numeric not null default 0,
  protein_g numeric not null default 0,
  fiber_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  sort_order int not null default 0
);

-- saved_meals
create table public.saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  note text,
  calories numeric not null default 0,
  protein_g numeric not null default 0,
  fiber_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index meals_user_eaten_idx on public.meals (user_id, eaten_at desc);
create index meal_items_meal_idx on public.meal_items (meal_id);

alter table public.profiles enable row level security;
alter table public.meals enable row level security;
alter table public.meal_items enable row level security;
alter table public.saved_meals enable row level security;

create policy "own profile select" on public.profiles
  for select using (id = auth.uid());
create policy "own profile update" on public.profiles
  for update using (id = auth.uid());
create policy "own profile insert" on public.profiles
  for insert with check (id = auth.uid());

create policy "own meals all" on public.meals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own meal_items all" on public.meal_items
  for all using (
    exists (
      select 1 from public.meals m
      where m.id = meal_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.meals m
      where m.id = meal_id and m.user_id = auth.uid()
    )
  );

create policy "own saved_meals all" on public.saved_meals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- auto-create profile
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

Meal totals on `meals` are the source of truth for the Today bars. When the editor saves, sum items into the meal row. Do not rely on a DB trigger for v1 unless it is simpler.

---

## 6. Auth

- Email magic link **and** Google OAuth if both are easy to turn on in the Supabase project. Magic link alone is acceptable for v1.
- `AuthGate` redirects unknown users to `/login`.
- After login, go to `/`.
- Settings has Sign out.
- Site URL + redirect URLs must include local Vite origin and the production host.

---

## 7. Analyze API

**Endpoint:** Supabase Edge Function `analyze`  
**Auth:** require a valid Supabase JWT. Reject anonymous calls.

**Client request**

```ts
type AnalyzeRequest = {
  note?: string;
  imageBase64?: string;   // raw base64, no data: prefix
  mimeType?: string;      // image/jpeg or image/webp
};
```

At least one of `note` or `imageBase64` is required.

**Before upload, the client must:**
- resize the image so the long edge is <= 1280px
- encode JPEG quality ~0.7
- skip upload if the file is not an image

**Gemini system prompt (use this text):**

```
You estimate nutrition from a meal photo and/or a short user note for personal tracking.

Priority: protein_g and fiber_g. Also return calories, carbs_g, fat_g.

Rules:
- Identify each visible or described food.
- Estimate portion in grams.
- If a user note is present, treat it as ground truth for ingredients and portions.
- Do not invent hidden oils, butter, or sauces unless they are visible or mentioned.
- If unsure, lower confidence and still give a best estimate.
- Return JSON only. No markdown.

JSON shape:
{
  "items": [
    {
      "name": "string",
      "grams": number,
      "calories": number,
      "protein_g": number,
      "fiber_g": number,
      "carbs_g": number,
      "fat_g": number
    }
  ],
  "totals": {
    "calories": number,
    "protein_g": number,
    "fiber_g": number,
    "carbs_g": number,
    "fat_g": number
  },
  "confidence": number,
  "assumptions": "short string"
}
```

`confidence` is 0–1. `totals` must equal the sum of items (round to 1 decimal for grams, 0 for calories is fine).

**Response to the client:** that same JSON. On failure return `{ error: string }` with HTTP 400/401/500 as appropriate.

Do not persist the image on the server.

---

## 8. Pages

### `/login`
- Magic link email field
- Optional Google button
- Short explanation: personal protein + fiber tracker

### `/` Today
- Date label (today). Optional prev/next day later; v1 can be today-only if needed, but prev/next day is small and useful — include it.
- Two large bars: Protein `current / goal g`, Fiber `current / goal g`
- Smaller line for calories if a calorie goal is set; otherwise show calories as plain text
- Meal list for that local calendar day
- Primary button: Add meal
- Nav: Today, Saved, Settings

Day boundaries use the **browser local timezone**, not UTC date. Helper: start/end of local day → ISO for the `eaten_at` filter.

### `/add`
- Photo picker (`input type="file" accept="image/*" capture="environment"`)
- Optional note textarea
- Analyze button
- Loading state
- Then reuse `MealEditor`
- Save writes `meals` + `meal_items`
- Optional checkbox: also save as template
- Cancel back to Today

### `/meals/:id`
- Load meal + items
- Same editor
- Delete meal
- “Save as template”

### `/saved`
- List saved meals
- Tap to create a new meal cloned from the template (`source = 'saved'`, `eaten_at = now()`)
- Rename / delete template

### `/settings`
- Display name
- Protein goal, fiber goal, optional calorie goal
- Sign out

---

## 9. UI rules

- Mobile first. Comfortable tap targets.
- Protein and fiber are visually dominant. Calories are secondary.
- Always allow editing AI numbers. Never save analyze output without an explicit Save tap.
- Show `assumptions` and `confidence` on the editor so the user can distrust a bad guess.
- Empty today state: “No meals yet. Add breakfast.”
- Errors are plain text, not toast libraries.

---

## 10. TypeScript types

```ts
export type MealSource = 'photo' | 'text' | 'saved' | 'manual';

export type MealItem = {
  id?: string;
  name: string;
  grams: number | null;
  calories: number;
  protein_g: number;
  fiber_g: number;
  carbs_g: number;
  fat_g: number;
  sort_order?: number;
};

export type Meal = {
  id: string;
  user_id: string;
  eaten_at: string;
  note: string | null;
  source: MealSource;
  calories: number;
  protein_g: number;
  fiber_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: number | null;
};

export type Profile = {
  id: string;
  display_name: string | null;
  protein_goal_g: number;
  fiber_goal_g: number;
  calorie_goal: number | null;
};

export type AnalyzeResult = {
  items: MealItem[];
  totals: {
    calories: number;
    protein_g: number;
    fiber_g: number;
    carbs_g: number;
    fat_g: number;
  };
  confidence: number;
  assumptions: string;
};
```

---

## 11. Implementation phases

### Phase 1 — App shell
- Vite React TS app
- Router + empty pages
- Supabase client
- AuthGate + magic link login
- Acceptance: you can sign in and see a blank Today page

### Phase 2 — Database
- Apply `0001_init.sql`
- Confirm a profile row appears after signup
- Acceptance: RLS blocks reading another user’s meals (test with two users if possible)

### Phase 3 — Manual meal
- Add/edit meal without AI
- Today totals update
- Settings goals work
- Acceptance: log “200g chicken + broccoli” by hand and see protein/fiber bars move

### Phase 4 — Analyze
- Image resize helper
- Edge Function + Gemini
- Wire Add meal photo/note
- Acceptance: a dinner photo returns editable items; Save persists them

### Phase 5 — Saved meals
- Save as template
- Clone to today
- Acceptance: “usual oats” logs in two taps

### Phase 6 — PWA polish
- Manifest, icons, theme color
- Basic offline shell (app loads; analyze still needs network)
- Acceptance: Add to Home Screen on a phone

Do not start Phase 4 until Phase 3 works. The app must be usable with no AI.

---

## 12. Security

- Anon key in the browser is OK. Service role key must never ship to the client.
- Gemini key only in Edge Function secrets.
- Analyze function verifies the JWT before calling Gemini.
- Optional cheap abuse guard: if you want, require the caller to have a `profiles` row (they will).
- Do not log base64 images.

---

## 13. Definition of done (v1)

- Two people can create accounts and only see their own meals
- Today shows protein + fiber vs goals
- Add meal from photo, text, or saved template
- User can edit every number before save
- Delete meal
- Sign out
- Works on a phone browser
- No photo stored in the database

---

## 14. Later (out of scope until asked)

- Barcode → Open Food Facts
- USDA lookup for typed foods
- Multi-day charts
- Shared household dashboard
- Store thumbnails
- Azure port

---

## 15. Cursor working style

- Follow this plan over improvising features.
- Prefer fewer files over abstract architecture.
- If a library is not listed, do not add it unless it is required to talk to Supabase or Gemini.
- When stuck on Gemini model IDs, use the current Flash vision model from Google AI Studio docs.
- After each phase, print what was created and how to run it.
