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

    const res = await fetch("/api/buy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ item_id: itemId, quantity: 1 }),
    });
    const body = await res.json();

    if (!res.ok) {
      setError(body.error ?? "Something went wrong placing the order.");
      setState("error");
      return;
    }

    setResult(body);
    setState("done");
  }

  if (!user) {
    return (
      <Link href="/login" className="text-sm underline text-gray-600">
        Log in to buy
      </Link>
    );
  }

  if (state === "done" && result) {
    return (
      <div className="text-sm text-green-700">
        <p>Ordered! #{result.order_id}</p>
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
        className="rounded bg-black text-white px-3 py-1 text-sm hover:bg-gray-800 disabled:opacity-50"
      >
        {state === "buying" ? "Placing order..." : "Buy"}
      </button>
      {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
    </div>
  );
}
