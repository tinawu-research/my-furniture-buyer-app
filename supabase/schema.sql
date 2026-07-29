-- Run this whole file once in the Supabase SQL Editor (Dashboard > SQL Editor > New query).
-- It creates the tables, security rules, and a few demo products.

-- One row per signed-up user, holding their budget.
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  budget numeric not null default 1000,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric not null,
  image_url text,
  category text,
  -- Below: populated by scripts/sync-products.mjs from the catalogue source.
  -- external_id is what makes re-running that script a safe update rather
  -- than a duplicate insert.
  external_id text unique,
  colours text[],
  width numeric,
  height numeric,
  depth numeric,
  source_url text
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  total numeric not null,
  created_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  product_id uuid not null references products (id),
  quantity int not null check (quantity > 0),
  price numeric not null
);

-- Row Level Security: every table is locked down by default;
-- these policies open the specific access each part of the app needs.
alter table profiles enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

create policy "Users can view their own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Anyone can view products"
  on products for select
  using (true);

create policy "Users can view their own orders"
  on orders for select
  using (auth.uid() = user_id);

create policy "Users can insert their own orders"
  on orders for insert
  with check (auth.uid() = user_id);

create policy "Users can view items from their own orders"
  on order_items for select
  using (
    exists (
      select 1 from orders
      where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
    )
  );

create policy "Users can insert items into their own orders"
  on order_items for insert
  with check (
    exists (
      select 1 from orders
      where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
    )
  );

-- Automatically create a profile (with a starting budget) whenever someone signs up.
-- search_path is pinned to public because this trigger runs under the auth
-- service's role, whose default search_path doesn't include it — without
-- this, "profiles" below can't be found and every signup fails.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, budget)
  values (new.id, new.email, 1000);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Products are loaded separately, after this file runs, by:
--   npm run sync-products
-- which pulls the real catalogue from the hackathon's MongoDB instance.
-- See README.md.
