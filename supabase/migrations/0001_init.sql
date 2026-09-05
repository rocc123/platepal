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
