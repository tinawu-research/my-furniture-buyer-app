"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

export default function ShopAssistant() {
  const { user, session } = useAuth();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pendingOrder, setPendingOrder] = useState(null);
  const [confirming, setConfirming] = useState(false);

  if (!user) {
    return (
      <div className="kuromi-card-pink p-4 mb-8 text-sm text-[var(--ink-soft)]">
        <Link href="/login" className="underline font-bold text-[var(--pink-dark)]">
          Log in
        </Link>{" "}
        to ask the shopping assistant a question.
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setLoading(true);
    setError(null);
    setPendingOrder(null);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message: text }),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(body.error ?? "Something went wrong.");
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: body.reply, toolCalls: body.toolCalls },
        ]);
        setPendingOrder(body.pendingOrder ?? null);
      }
    } catch {
      setError("Couldn't reach the assistant. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmOrder() {
    if (!pendingOrder || confirming) return;
    setConfirming(true);
    setError(null);

    try {
      const res = await fetch("/api/buy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ item_id: pendingOrder.item_id, quantity: pendingOrder.quantity }),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: `Order failed: ${body.error ?? "something went wrong"}` },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: `Order placed. Total charged: $${Number(body.total_price).toFixed(2)}. Remaining balance: $${Number(body.remaining_balance).toFixed(2)}.`,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Order failed: couldn't reach the shop." },
      ]);
    } finally {
      setConfirming(false);
      setPendingOrder(null);
    }
  }

  function handleCancelOrder() {
    setPendingOrder(null);
    setMessages((prev) => [...prev, { role: "assistant", text: "Order cancelled." }]);
  }

  return (
    <div className="kuromi-card p-4 mb-8">
      <h2 className="font-heading font-bold text-lg mb-1">
        Ask the shopping assistant <span aria-hidden>🎀</span>
      </h2>
      <p className="text-sm text-[var(--ink-soft)] mb-3">
        e.g. &quot;find me a cheap chair&quot; or &quot;anything in blue under $100?&quot;
      </p>

      {messages.length > 0 && (
        <div className="flex flex-col gap-3 mb-3 max-h-80 overflow-y-auto pr-1">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
              <p
                className={`inline-block rounded-2xl px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap border-2 border-[var(--ink)] ${
                  m.role === "user"
                    ? "bg-[var(--ink)] text-[var(--pink)]"
                    : "bg-[var(--pink-light)] text-[var(--ink)]"
                }`}
              >
                {m.text}
              </p>
              {m.toolCalls?.length > 0 && (
                <p className="text-xs text-[var(--ink-soft)]/70 mt-1">
                  used: {m.toolCalls.map((t) => t.name).join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {pendingOrder && (
        <div className="kuromi-card-pink p-3 mb-3 text-sm">
          <p className="mb-2">
            Confirm purchase: <span className="font-bold">{pendingOrder.quantity}&times; {pendingOrder.name}</span>{" "}
            for <span className="kuromi-price font-extrabold">${Number(pendingOrder.total).toFixed(2)}</span>?
          </p>
          <p className="text-xs text-[var(--ink-soft)] mb-2">
            This charges your account immediately and cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirmOrder}
              disabled={confirming}
              className="kuromi-btn kuromi-btn-primary px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {confirming ? "Placing order..." : "Confirm purchase 🎀"}
            </button>
            <button
              type="button"
              onClick={handleCancelOrder}
              disabled={confirming}
              className="kuromi-btn kuromi-btn-secondary px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-[var(--pink-dark)] text-sm mb-2 font-bold">{error}</p>}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me anything about the catalogue..."
          className="kuromi-input flex-1 px-3 py-2 text-sm"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="kuromi-btn kuromi-btn-primary px-4 py-2 text-sm disabled:opacity-50"
        >
          {loading ? "Thinking..." : "Ask"}
        </button>
      </form>
    </div>
  );
}
