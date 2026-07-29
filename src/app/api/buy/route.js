import { createClient } from "@supabase/supabase-js";
import { placeOrder } from "@/lib/externalApi";

// Places a real order through the external Product Search API (Level 2).
// Server-only: EXTERNAL_API_KEY must never reach the browser.
export async function POST(request) {
  const authHeader = request.headers.get("Authorization") ?? "";
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: authHeader } } }
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { item_id, quantity } = await request.json().catch(() => ({}));
  if (!item_id) {
    return Response.json({ error: "Missing item_id" }, { status: 400 });
  }

  try {
    const order = await placeOrder({ itemId: item_id, quantity });
    return Response.json(order, { status: 201 });
  } catch (err) {
    if (err.status) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json(
      { error: "Couldn't reach the furniture shop's API. Try again shortly." },
      { status: 502 }
    );
  }
}
