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

  if (!user) {
    return (
      <div className="border rounded-lg p-4 mb-8 text-sm text-gray-600">
        <Link href="/login" className="underline font-medium">
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
      }
    } catch {
      setError("Couldn't reach the assistant. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border rounded-lg p-4 mb-8">
      <h2 className="font-semibold mb-1">Ask the shopping assistant</h2>
      <p className="text-sm text-gray-500 mb-3">
        e.g. &quot;find me a cheap chair&quot; or &quot;anything in blue under $100?&quot;
      </p>

      {messages.length > 0 && (
        <div className="flex flex-col gap-3 mb-3 max-h-80 overflow-y-auto">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
              <p
                className={`inline-block rounded-lg px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap ${
                  m.role === "user" ? "bg-black text-white" : "bg-gray-100"
                }`}
              >
                {m.text}
              </p>
              {m.toolCalls?.length > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  used: {m.toolCalls.map((t) => t.name).join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me anything about the catalogue..."
          className="flex-1 border rounded px-3 py-2 text-sm"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded bg-black text-white px-4 py-2 text-sm hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? "Thinking..." : "Ask"}
        </button>
      </form>
    </div>
  );
}
