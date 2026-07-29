import { createClient } from "@supabase/supabase-js";
import { runShopAssistant } from "@/lib/azureAgent";

// Runs a user's plain-English request through the shop assistant agent.
// Requires a logged-in Supabase session, same pattern as the other
// external-API-backed routes.
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

  const { message } = await request.json().catch(() => ({}));
  if (!message || typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "Missing message" }, { status: 400 });
  }

  try {
    const result = await runShopAssistant(message.trim());
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err.message }, { status: err.status ?? 502 });
  }
}
