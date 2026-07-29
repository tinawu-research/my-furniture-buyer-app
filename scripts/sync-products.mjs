// One-off data load: pulls the furniture catalogue from the hackathon's
// MongoDB instance and loads it into our Supabase `products` table,
// replacing the placeholder demo rows. Safe to re-run — products are
// matched by `external_id` (the source item_id), so re-running updates
// existing rows instead of duplicating them.
//
// Usage: npm run sync-products
// Requires MONGODB_URI, NEXT_PUBLIC_SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY to be set in .env.local (see .env.local.example).

import { MongoClient } from "mongodb";
import { createClient } from "@supabase/supabase-js";

const BATCH_SIZE = 25;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function toProductRow(doc) {
  const descriptionParts = [];
  if (doc.colours?.length) {
    descriptionParts.push(`Available in ${doc.colours.join(", ")}`);
  }
  const dims = ["width", "height", "depth"]
    .map((key) => doc[key])
    .filter((value) => value != null);
  if (dims.length) {
    descriptionParts.push(`${dims.join(" x ")} cm`);
  }

  return {
    external_id: doc.item_id,
    name: doc.product_name,
    description: descriptionParts.join(". ") || null,
    price: doc.price,
    image_url: doc.image_url
      ? `data:${doc.image_mime_type ?? "image/jpeg"};base64,${doc.image_url}`
      : null,
    category: doc.category ?? null,
    colours: doc.colours ?? null,
    width: doc.width ?? null,
    height: doc.height ?? null,
    depth: doc.depth ?? null,
    source_url: doc.link ?? null,
  };
}

async function main() {
  const mongoUri = requireEnv("MONGODB_URI");
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const mongo = new MongoClient(mongoUri);
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    await mongo.connect();
    const docs = await mongo.db().collection("catalog").find().toArray();
    console.log(`Fetched ${docs.length} products from MongoDB.`);

    const rows = docs.map(toProductRow);

    console.log("Removing leftover placeholder products...");
    const { error: deleteError } = await supabase
      .from("products")
      .delete()
      .is("external_id", null);
    if (deleteError) throw deleteError;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from("products")
        .upsert(batch, { onConflict: "external_id" });
      if (error) throw new Error(`Batch starting at row ${i} failed: ${error.message}`);
      console.log(`Synced ${Math.min(i + BATCH_SIZE, rows.length)} / ${rows.length}`);
    }

    console.log("Done.");
  } finally {
    await mongo.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
