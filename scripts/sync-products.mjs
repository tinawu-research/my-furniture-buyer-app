// One-off data load: pulls the furniture catalogue from the hackathon's
// MongoDB instance and loads it into our Supabase `products` table,
// replacing the placeholder demo rows. Safe to re-run — products are
// matched by `external_id` (the source item_id), so re-running updates
// existing rows instead of duplicating them.
//
// Product photos are uploaded to the "product-images" Storage bucket
// rather than stored inline as base64 text: with 762 products averaging
// ~120KB of image data each, a `select *` on the products table (which the
// home page does on every load) was too large/slow and started hitting
// Postgres's statement timeout. Storage keeps each row small and serves
// images over their own URL instead of embedding them in every query.
//
// Usage: npm run sync-products
// Requires MONGODB_URI, NEXT_PUBLIC_SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY to be set in .env.local (see .env.local.example).
// Assumes a public "product-images" Storage bucket already exists.

import { MongoClient } from "mongodb";
import { createClient } from "@supabase/supabase-js";

const BATCH_SIZE = 100;
const UPLOAD_CONCURRENCY = 20;
const BUCKET = "product-images";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function buildDescription(doc) {
  const parts = [];
  if (doc.colours?.length) {
    parts.push(`Available in ${doc.colours.join(", ")}`);
  }
  const dims = ["width", "height", "depth"]
    .map((key) => doc[key])
    .filter((value) => value != null);
  if (dims.length) {
    parts.push(`${dims.join(" x ")} cm`);
  }
  return parts.join(". ") || null;
}

async function uploadImage(supabase, doc) {
  if (!doc.image_url) return null;

  const mimeType = doc.image_mime_type ?? "image/jpeg";
  const extension = mimeType.split("/")[1] ?? "jpg";
  const path = `${doc.item_id}.${extension}`;
  const buffer = Buffer.from(doc.image_url, "base64");

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: mimeType, upsert: true });
  if (error) throw new Error(`Image upload failed for ${doc.item_id}: ${error.message}`);

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function toProductRow(doc, imageUrl) {
  return {
    external_id: doc.item_id,
    name: doc.product_name,
    description: buildDescription(doc),
    price: doc.price,
    image_url: imageUrl,
    category: doc.category ?? null,
    colours: doc.colours ?? null,
    width: doc.width ?? null,
    height: doc.height ?? null,
    depth: doc.depth ?? null,
    source_url: doc.link ?? null,
  };
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
  const mongoUri = requireEnv("MONGODB_URI");
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const mongo = new MongoClient(mongoUri);
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
  if (bucketsError) throw bucketsError;
  if (!buckets.some((b) => b.name === BUCKET)) {
    console.log(`Creating "${BUCKET}" storage bucket...`);
    const { error: createBucketError } = await supabase.storage.createBucket(BUCKET, {
      public: true,
    });
    if (createBucketError) throw createBucketError;
  }

  try {
    await mongo.connect();
    const docs = await mongo.db().collection("catalog").find().toArray();
    console.log(`Fetched ${docs.length} products from MongoDB.`);

    console.log("Uploading images to Supabase Storage...");
    let uploaded = 0;
    const rows = await mapWithConcurrency(docs, UPLOAD_CONCURRENCY, async (doc) => {
      const imageUrl = await uploadImage(supabase, doc);
      uploaded += 1;
      if (uploaded % 50 === 0 || uploaded === docs.length) {
        console.log(`Uploaded ${uploaded} / ${docs.length} images`);
      }
      return toProductRow(doc, imageUrl);
    });

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
