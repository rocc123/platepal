alter table public.meals
  add column if not exists name text;

comment on column public.meals.name is
  'Everyday dish name shown on Today. Note stays optional extra context.';

with foods as (
  select
    meal_id,
    array_agg(trim(name) order by sort_order) filter (where trim(name) <> '') as names
  from public.meal_items
  group by meal_id
)
update public.meals m
set name = coalesce(
  nullif(trim(m.name), ''),
  case
    when f.names is null or cardinality(f.names) = 0 then null
    when cardinality(f.names) = 1 then f.names[1]
    when cardinality(f.names) = 2 then f.names[1] || ' + ' || f.names[2]
    when cardinality(f.names) = 3 then f.names[1] || ' + ' || f.names[2] || ' + ' || f.names[3]
    else f.names[1] || ' + ' || f.names[2] || ' + ' || (cardinality(f.names) - 2)::text || ' more'
  end,
  case
    when m.note is not null and char_length(trim(m.note)) <= 42 and position(',' in m.note) = 0
      then trim(m.note)
    else null
  end,
  'Meal'
)
from foods f
where f.meal_id = m.id;

update public.meals
set name = coalesce(
  nullif(trim(name), ''),
  case
    when note is not null and char_length(trim(note)) <= 42 and position(',' in note) = 0
      then trim(note)
    else null
  end,
  'Meal'
)
where name is null or trim(name) = '';

-- Notes that were only a copy of the title or first food are not notes.
update public.meals m
set note = null
where m.note is not null
  and (
    lower(trim(m.note)) = lower(trim(coalesce(m.name, '')))
    or exists (
      select 1
      from public.meal_items i
      where i.meal_id = m.id
        and i.sort_order = 0
        and lower(trim(i.name)) = lower(trim(m.note))
    )
  );
