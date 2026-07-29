// Server-only client for the hackathon's external "Product Search API"
// (Level 2, day1.training.cognitivo.com.au). Never import this from a
// Client Component — EXTERNAL_API_KEY must not reach the browser.
//
// Shared by the balance/buy/order-history routes and the shop assistant
// agent's tools, so the request-shape and error-handling fixes we learned
// by testing against the real API (see CLAUDE.md) live in one place.

function toErrorMessage(raw, fallback) {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    return raw.map((e) => e?.msg ?? JSON.stringify(e)).join("; ") || fallback;
  }
  if (raw && typeof raw === "object") return JSON.stringify(raw);
  return fallback;
}

function requireConfig() {
  const baseUrl = process.env.EXTERNAL_API_BASE_URL;
  const userId = process.env.EXTERNAL_API_USER_ID;
  const apiKey = process.env.EXTERNAL_API_KEY;
  if (!baseUrl || !userId || !apiKey) {
    const err = new Error("External API credentials aren't configured yet (see .env.local).");
    err.status = 501;
    throw err;
  }
  return { baseUrl, userId, apiKey };
}

export async function searchCatalogue({ category, limit, skip } = {}) {
  const { baseUrl } = requireConfig();
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  params.set("limit", String(limit ?? 20));
  if (skip) params.set("skip", String(skip));

  const res = await fetch(`${baseUrl}/catalogue/search-index?${params}`, { cache: "no-store" });
  const body = await res.json().catch(() => []);
  if (!res.ok) {
    const err = new Error(
      toErrorMessage(body?.error ?? body?.detail, `Search failed (status ${res.status}).`)
    );
    err.status = res.status;
    throw err;
  }
  return body;
}

export async function getProduct(itemId) {
  const { baseUrl } = requireConfig();
  const res = await fetch(`${baseUrl}/catalogue/${encodeURIComponent(itemId)}`, {
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    let message = toErrorMessage(
      body?.error ?? body?.detail,
      `Lookup failed (status ${res.status}).`
    );
    if (res.status === 404) message = "This item is no longer available.";
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  // Drop the embedded base64 image — nothing that calls this (the agent's
  // tool, any JSON API consumer) needs raw image bytes in a text response.
  const { image_url: _imageUrl, ...rest } = body;
  return rest;
}

export async function checkBalance() {
  const { baseUrl, userId, apiKey } = requireConfig();
  const res = await fetch(`${baseUrl}/users/${userId}`, {
    headers: { "X-Api-Key": apiKey },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(
      toErrorMessage(body?.error ?? body?.detail, `Balance check failed (status ${res.status}).`)
    );
    err.status = res.status;
    throw err;
  }
  return { balance: body.balance, name: body.name };
}

export async function placeOrder({ itemId, quantity }) {
  const { baseUrl, userId, apiKey } = requireConfig();
  const res = await fetch(`${baseUrl}/orders`, {
    method: "POST",
    headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: userId,
      items: [{ item_id: itemId, quantity: quantity ?? 1 }],
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    let message = toErrorMessage(
      body?.error ?? body?.detail,
      `Order failed (status ${res.status}).`
    );
    if (res.status === 402) {
      message = "Insufficient balance: this order costs more than you have left.";
    } else if (res.status === 404) {
      message = "This item is no longer available.";
    } else if (res.status === 429) {
      const retryAfter = res.headers.get("Retry-After");
      message = retryAfter
        ? `Too many requests — try again in ${retryAfter}s.`
        : "Too many requests — try again shortly.";
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return body;
}

export async function getOrderHistory() {
  const { baseUrl, userId, apiKey } = requireConfig();
  const res = await fetch(`${baseUrl}/orders/${userId}`, {
    headers: { "X-Api-Key": apiKey },
    cache: "no-store",
  });
  const body = await res.json().catch(() => []);
  if (!res.ok) {
    const err = new Error(
      toErrorMessage(
        body?.error ?? body?.detail,
        `Order history request failed (status ${res.status}).`
      )
    );
    err.status = res.status;
    throw err;
  }
  return Array.isArray(body) ? body : [];
}
