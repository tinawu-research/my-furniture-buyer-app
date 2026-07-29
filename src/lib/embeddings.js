// Local text embeddings for Vector RAG product search — no API key needed.
// The Azure resource given out for Day 1 only has a chat deployment
// (gpt-5-mini), no embedding model (confirmed by probing common deployment
// names directly against the endpoint — all came back DeploymentNotFound).
// Rather than requiring a second external credential (e.g. an OpenAI key)
// just for embeddings, this runs Xenova/all-MiniLM-L6-v2 directly in Node
// via @xenova/transformers — downloads once (~90MB, cached under
// node_modules/@xenova on first use), then runs fully offline. 384-dim
// output; must match the `vector(384)` column in supabase/vector-search.sql.

import { pipeline } from "@xenova/transformers";

let extractorPromise = null;

function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return extractorPromise;
}

export async function embedText(text) {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}
