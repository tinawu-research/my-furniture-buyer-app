// Vector similarity search over Supabase's own `products` table — see
// CLAUDE.md, "Vector RAG product search". Server-only: uses the service
// role key (read-only usage here, but the key itself bypasses RLS, so it
// must never reach the browser).
//
// This is a different data source from src/lib/externalApi.js: that talks
// to the organizer's live external API (real prices/balance/orders);
// this queries Supabase's local, embedded copy of the same 762-item
// catalogue purely for semantic search. get_product/check_balance/
// place_order still go through externalApi.js against the live API.

import { createClient } from "@supabase/supabase-js";
import { embedText } from "@/lib/embeddings";

function requireConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    const err = new Error("Product search isn't configured yet (see .env.local).");
    err.status = 501;
    throw err;
  }
  return createClient(url, serviceRoleKey);
}

export async function vectorSearchProducts({ query, category, maxPrice, limit } = {}) {
  if (!query) {
    const err = new Error("A search query is required.");
    err.status = 400;
    throw err;
  }

  const supabase = requireConfig();
  const queryEmbedding = await embedText(query);

  const { data, error } = await supabase.rpc("match_products", {
    query_embedding: queryEmbedding,
    match_count: limit ?? 10,
    filter_category: category ?? null,
    max_price: maxPrice ?? null,
  });

  if (error) {
    const err = new Error(`Product search failed: ${error.message}`);
    err.status = 502;
    throw err;
  }

  return data.map((row) => ({
    item_id: row.external_id,
    product_name: row.name,
    description: row.description,
    price: row.price,
    category: row.category,
    colours: row.colours,
    similarity: row.similarity,
  }));
}
