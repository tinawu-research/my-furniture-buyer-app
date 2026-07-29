import { createClient } from "@supabase/supabase-js";

// Creates users as already-confirmed, via the service role key, so signup
// doesn't depend on Supabase sending a confirmation email — the free tier's
// email rate limit made that path unreliable for a hackathon demo.
export async function POST(request) {
  const { email, password } = await request.json();
  if (!email || !password) {
    return Response.json({ error: "Email and password are required" }, { status: 400 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true }, { status: 201 });
}
