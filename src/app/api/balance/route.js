import { createClient } from "@supabase/supabase-js";

// Fetches the real balance from the external Product Search API (Level 2).
// Server-only: EXTERNAL_API_KEY must never reach the browser — "anyone
// holding it can act as your user" per the Day 1 Participant Guide.
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

  const res = await fetch(`${baseUrl}/users/${externalUserId}`, {
    headers: { "X-Api-Key": apiKey },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return Response.json(
      { error: body.error ?? body.detail ?? `Balance API returned ${res.status}` },
      { status: res.status }
    );
  }

  const data = await res.json();
  return Response.json({ balance: data.balance, name: data.name });
}
