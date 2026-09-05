create table public.meal_sources (
  id smallint primary key,
  code text not null unique,
  label text not null,
  sort_order int not null default 0
);

create table public.meal_periods (
  id smallint primary key,
  code text not null unique,
  label text not null,
  sort_order int not null default 0,
  start_hour smallint,
  end_hour smallint
);

insert into public.meal_sources (id, code, label, sort_order) values
  (1, 'photo', 'Photo', 1),
  (2, 'text', 'Text', 2),
  (3, 'saved', 'Saved', 3),
  (4, 'manual', 'Manual', 4);

insert into public.meal_periods (id, code, label, sort_order, start_hour, end_hour) values
  (1, 'breakfast', 'Breakfast', 1, 5, 11),
  (2, 'lunch', 'Lunch', 2, 11, 16),
  (3, 'dinner', 'Dinner', 3, 16, 22),
  (4, 'snack', 'Snack', 4, 22, 5);

alter table public.meal_sources enable row level security;
alter table public.meal_periods enable row level security;

create policy "read meal_sources" on public.meal_sources
  for select using (true);
create policy "read meal_periods" on public.meal_periods
  for select using (true);

alter table public.meals
  add column source_id smallint references public.meal_sources (id),
  add column meal_period_id smallint references public.meal_periods (id),
  add column tz_name text,
  add column tz_offset_minutes int;

update public.meals m
set source_id = s.id
from public.meal_sources s
where s.code = m.source;

update public.meals
set
  meal_period_id = 4,
  tz_name = coalesce(tz_name, 'UTC'),
  tz_offset_minutes = coalesce(tz_offset_minutes, 0)
where meal_period_id is null;

alter table public.meals
  alter column source_id set not null,
  alter column meal_period_id set not null,
  alter column tz_name set not null,
  alter column tz_offset_minutes set not null;

alter table public.meals drop constraint meals_source_check;
alter table public.meals drop column source;

create index meals_user_period_idx on public.meals (user_id, meal_period_id);
