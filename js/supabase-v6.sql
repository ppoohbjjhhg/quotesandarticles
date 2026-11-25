-- Cole no Supabase SQL Editor e execute para habilitar banners e bios de até 120 caracteres.

alter table public.profiles
  add column if not exists banner text,
  add column if not exists banner_blur boolean not null default false,
  add column if not exists bio_long varchar(120);

update public.profiles
set bio_long = left(bio::text, 120)
where bio_long is null and bio is not null;

alter table public.profiles
  drop constraint if exists profiles_bio_long_max_120;

alter table public.profiles
  add constraint profiles_bio_long_max_120
  check (bio_long is null or char_length(bio_long) <= 120);

create or replace view public.profile_banners as
  select id, banner, banner_blur, bio_long
  from public.profiles;

grant select on public.profile_banners to anon, authenticated;
