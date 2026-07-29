import { createClient } from "@supabase/supabase-js";
import { getOrderHistory } from "@/lib/externalApi";

// Fetches real order history from the external Product Search API
// (Level 2). Server-only: EXTERNAL_API_KEY must never reach the browser.
export async function GET(request) {
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

  try {
    const orders = await getOrderHistory();
    return Response.json({ orders });
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
