import { createClient } from "@supabase/supabase-js";

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

  const baseUrl = process.env.EXTERNAL_API_BASE_URL;
  const externalUserId = process.env.EXTERNAL_API_USER_ID;
  const apiKey = process.env.EXTERNAL_API_KEY;

  if (!baseUrl || !externalUserId || !apiKey) {
    return Response.json(
      { error: "External API credentials aren't configured yet (see .env.local)." },
      { status: 501 }
    );
  }

  const { item_id, quantity } = await request.json();
  if (!item_id) {
    return Response.json({ error: "Missing item_id" }, { status: 400 });
  }

  const res = await fetch(`${baseUrl}/orders`, {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: externalUserId,
      item_id,
      quantity: quantity ?? 1,
    }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    let message = body.error ?? body.detail ?? `Order failed (status ${res.status}).`;
    if (res.status === 402) {
      message = "This order costs more than your remaining balance.";
    } else if (res.status === 429) {
      const retryAfter = res.headers.get("Retry-After");
      message = retryAfter
        ? `Too many requests — try again in ${retryAfter}s.`
        : "Too many requests — try again shortly.";
    }
    return Response.json({ error: message }, { status: res.status });
  }

  return Response.json(body, { status: res.status });
}
