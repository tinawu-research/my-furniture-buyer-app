-- Run this once in the Supabase SQL Editor (Dashboard > SQL Editor > New
-- query), after schema.sql and after `npm run sync-products` has populated
-- the products table. Adds vector similarity search over the catalogue,
-- used by the shop assistant's search_catalogue tool (see CLAUDE.md,
-- "Vector RAG product search").

create extension if not exists vector;

-- 384 dimensions: matches the Xenova/all-MiniLM-L6-v2 model used by
-- scripts/embed-products.mjs and src/lib/embeddings.js. Change both if you
-- ever swap embedding models.
alter table products add column if not exists embedding vector(384);

-- No index (e.g. ivfflat) on purpose: at 762 rows a full sequential scan
-- over the embedding column is a few milliseconds — not worth the
-- complexity/tuning an approximate-nearest-neighbor index needs at this
-- scale. Revisit only if the catalogue grows by orders of magnitude.

create or replace function match_products(
  query_embedding vector(384),
  match_count int default 10,
  filter_category text default null,
  max_price numeric default null
)
returns table (
  external_id text,
  name text,
  description text,
  price numeric,
  category text,
  colours text[],
  similarity float
)
language sql stable
as $$
  select
    products.external_id,
    products.name,
    products.description,
    products.price,
    products.category,
    products.colours,
    1 - (products.embedding <=> query_embedding) as similarity
  from products
  where products.embedding is not null
    and (filter_category is null or products.category ilike filter_category)
    and (max_price is null or products.price <= max_price)
  order by products.embedding <=> query_embedding
  limit match_count;
$$;
