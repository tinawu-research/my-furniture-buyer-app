"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [mode, setMode] = useState("login"); // "login" or "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      setSubmitting(false);
      if (error) {
        setError(error.message);
        return;
      }
      router.push("/");
    } else {
      const signupRes = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const signupBody = await signupRes.json();
      if (!signupRes.ok) {
        setSubmitting(false);
        setError(signupBody.error ?? "Something went wrong signing up.");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setSubmitting(false);
      if (error) {
        setError(error.message);
        return;
      }
      router.push("/");
    }
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-16">
      <div className="kuromi-card p-6">
        <h1 className="font-heading text-3xl font-extrabold mb-1 text-center">
          {mode === "login" ? "Welcome back 🎀" : "Join the club 💀"}
        </h1>
        <p className="text-center text-sm text-[var(--ink-soft)] mb-6">
          {mode === "login" ? "Log in to keep shopping." : "Sign up in seconds."}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-bold">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="kuromi-input px-3 py-2 font-normal"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-bold">
            Password
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="kuromi-input px-3 py-2 font-normal"
            />
          </label>

          {error && <p className="text-sm text-[var(--pink-dark)] font-bold">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="kuromi-btn kuromi-btn-primary px-4 py-2.5 disabled:opacity-50"
          >
            {submitting ? "Please wait..." : mode === "login" ? "Log in" : "Sign up"}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
          }}
          className="mt-4 text-sm text-[var(--ink-soft)] hover:text-[var(--pink-dark)] hover:underline w-full text-center"
        >
          {mode === "login"
            ? "Need an account? Sign up"
            : "Already have an account? Log in"}
        </button>
      </div>
    </div>
  );
}
