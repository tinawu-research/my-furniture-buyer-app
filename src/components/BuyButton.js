"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

export default function BuyButton({ itemId }) {
  const { user, session } = useAuth();
  const [state, setState] = useState("idle"); // idle | buying | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleBuy() {
    setState("buying");
    setError(null);

    try {
      const res = await fetch("/api/buy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ item_id: itemId, quantity: 1 }),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(body.error ?? "Something went wrong placing the order.");
        setState("error");
        return;
      }

      setResult(body);
      setState("done");
    } catch {
      setError("Something went wrong placing the order. Try again.");
      setState("error");
    }
  }

  if (!user) {
    return (
      <Link href="/login" className="text-sm underline text-[var(--ink-soft)]">
        Log in to buy
      </Link>
    );
  }

  if (state === "done" && result) {
    return (
      <div className="text-sm font-bold text-[var(--pink-dark)]">
        <p>Ordered! 🎀 #{result.order_id}</p>
        <p>Charged ${Number(result.total_price).toFixed(2)}</p>
        <p>New balance: ${Number(result.remaining_balance).toFixed(2)}</p>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handleBuy}
        disabled={state === "buying"}
        className="kuromi-btn kuromi-btn-primary px-3 py-1 text-sm disabled:opacity-50"
      >
        {state === "buying" ? "Placing order..." : "Buy"}
      </button>
      {error && <p className="text-[var(--pink-dark)] text-xs mt-1 font-bold">{error}</p>}
    </div>
  );
}
