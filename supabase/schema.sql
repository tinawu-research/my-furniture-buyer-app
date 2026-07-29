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
  category text
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
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, budget)
  values (new.id, new.email, 1000);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Demo furniture so the catalogue isn't empty.
insert into products (name, description, price, category) values
  ('Oak Dining Table', 'Solid oak, seats 6', 899.00, 'Dining'),
  ('Linen Sofa', '3-seater, machine-washable covers', 1299.00, 'Living Room'),
  ('Bedside Lamp', 'Warm-white LED, dimmable', 45.00, 'Lighting'),
  ('Bookshelf', '5-tier walnut veneer', 220.00, 'Storage'),
  ('Office Chair', 'Ergonomic mesh back', 175.00, 'Office'),
  ('Coffee Table', 'Tempered glass top, steel frame', 150.00, 'Living Room'),
  ('Bar Stool', 'Set of 2, adjustable height', 99.00, 'Dining'),
  ('Wardrobe', '3-door with mirror', 480.00, 'Bedroom')
on conflict do nothing;
