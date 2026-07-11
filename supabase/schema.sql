-- Schema for the travel photography portfolio.
-- Run this in the Supabase SQL editor.

create table if not exists places (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  hero_image_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists images (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references places (id) on delete cascade,
  url text not null,
  caption text default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists images_place_id_idx on images (place_id);

-- Row Level Security ---------------------------------------------------------
alter table places enable row level security;
alter table images enable row level security;

-- Public read access for the portfolio front-end.
create policy "Public read places" on places
  for select using (true);
create policy "Public read images" on images
  for select using (true);

-- Only authenticated (admin) users can write.
create policy "Auth write places" on places
  for all to authenticated using (true) with check (true);
create policy "Auth write images" on images
  for all to authenticated using (true) with check (true);
