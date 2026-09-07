alter table public.meals
  add column duration_minutes int not null default 15
    check (duration_minutes >= 0 and duration_minutes <= 240);

comment on column public.meals.duration_minutes is
  'How long the meal lasted. Fasting starts at eaten_at + duration_minutes.';
