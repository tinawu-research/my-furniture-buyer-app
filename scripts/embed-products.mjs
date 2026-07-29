// One-off backfill: computes a 384-dim embedding for every product in
// Supabase's `products` table (see scripts/sync-products.mjs, which must
// have already been run) and stores it in the `embedding` column added by
// supabase/vector-search.sql. Powers the shop assistant's vector-search
// search_catalogue tool — see CLAUDE.md, "Vector RAG product search".
//
// Safe to re-run any time the catalogue changes (e.g. after re-running
// sync-products) — it just recomputes and overwrites every row's embedding.
//
// Usage: npm run embed-products
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in
// .env.local, and that vector-search.sql has already been run in the
// Supabase SQL Editor (so the `embedding` column and `vector` extension
// exist).

import { createClient } from "@supabase/supabase-js";
import { embedText } from "../src/lib/embeddings.js";

const BATCH_SIZE = 50;
const CONCURRENCY = 8;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function buildEmbeddingInput(product) {
  const parts = [product.name];
  if (product.category) parts.push(product.category);
  if (product.description) parts.push(product.description);
  if (product.colours?.length) parts.push(`Colours: ${product.colours.join(", ")}`);
  parts.push(`Price: $${product.price}`);
  return parts.join(". ");
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

async function main() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, description, category, colours, price")
    .not("external_id", "is", null);
  if (error) throw error;

  console.log(`Embedding ${products.length} products (first run downloads the model, ~90MB)...`);

  let done = 0;
  const rows = await mapWithConcurrency(products, CONCURRENCY, async (product) => {
    const embedding = await embedText(buildEmbeddingInput(product));
    done += 1;
    if (done % 50 === 0 || done === products.length) {
      console.log(`Embedded ${done} / ${products.length}`);
    }
    return { id: product.id, embedding };
  });

  console.log("Writing embeddings to Supabase...");
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(({ id, embedding }) =>
        supabase.from("products").update({ embedding }).eq("id", id)
      )
    );
    console.log(`Saved ${Math.min(i + BATCH_SIZE, rows.length)} / ${rows.length}`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
