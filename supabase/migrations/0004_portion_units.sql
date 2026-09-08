alter table public.meal_items
  add column if not exists quantity numeric,
  add column if not exists unit text,
  add column if not exists grams_per_unit numeric,
  add column if not exists measures jsonb,
  add column if not exists per_100g jsonb;

comment on column public.meal_items.quantity is
  'How many of unit were eaten. Grams stay the source of truth.';
comment on column public.meal_items.unit is
  'Household or count unit for quantity: serving, piece, cup, tbsp, tsp, oz, ml, g.';
comment on column public.meal_items.grams_per_unit is
  'Grams in one unit, so 2 servings or 1/3 cup can be converted.';
comment on column public.meal_items.measures is
  'Other conversions we know for this food (USDA household measures, derived cups).';
comment on column public.meal_items.per_100g is
  'Nutrition per 100g when the food came from a lookup, used to rescale portions.';
