import { createClient } from "@supabase/supabase-js";

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

  const baseUrl = process.env.EXTERNAL_API_BASE_URL;
  const externalUserId = process.env.EXTERNAL_API_USER_ID;
  const apiKey = process.env.EXTERNAL_API_KEY;

  if (!baseUrl || !externalUserId || !apiKey) {
    return Response.json(
      { error: "External API credentials aren't configured yet (see .env.local)." },
      { status: 501 }
    );
  }

  try {
    const res = await fetch(`${baseUrl}/orders/${externalUserId}`, {
      headers: { "X-Api-Key": apiKey },
      cache: "no-store",
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      const raw = body.error ?? body.detail;
      const message =
        typeof raw === "string"
          ? raw
          : Array.isArray(raw)
            ? raw.map((e) => e?.msg ?? JSON.stringify(e)).join("; ")
            : `Order history request failed (status ${res.status}).`;
      return Response.json({ error: message }, { status: res.status });
    }

    return Response.json({ orders: Array.isArray(body) ? body : [] });
  } catch {
    return Response.json(
      { error: "Couldn't reach the furniture shop's API. Try again shortly." },
      { status: 502 }
    );
  }
}
