// Shop assistant: a tool-calling agent backed by an Azure-hosted GPT-5 mini
// deployment (chosen over Claude for this feature — see CLAUDE.md). Server
// only: AZURE_AI_API_KEY must never reach the browser.
//
// GPT-5 mini is a reasoning model — omitting reasoning_effort or leaving
// max_completion_tokens too low means every token gets spent on invisible
// reasoning and the response comes back empty (confirmed by testing
// directly against the endpoint). "low" effort plus a few thousand tokens
// is comfortably enough for this assistant's tasks.

import { getProduct, checkBalance } from "@/lib/externalApi";
import { vectorSearchProducts } from "@/lib/productSearch";

const SYSTEM_PROMPT = `You are a shopping assistant for a furniture shop. You have four tools:

- search_catalogue: semantic (vector) search over the catalogue — describe what the user wants in plain language (colour, vibe, room, style, use-case) in the query, and it returns the closest matches ranked by similarity. Pass category and/or max_price too whenever the user gave an exact category or an explicit numeric price limit — those are applied as real filters, not just described in the query text.
- get_product: full detail for one specific item you already have the item_id for (from a prior search_catalogue call). Not for browsing. Calls the real external API.
- check_balance: the user's real, current account balance, from the real external API. A snapshot number only, no transaction history.
- place_order: stages a proposed purchase (item_id + quantity) for the user to confirm — it does NOT charge anything by itself. Once the user confirms (through a UI button, not by replying to you), the purchase executes immediately and cannot be undone, against the real external API.

Only call place_order when the user has given an explicit, unambiguous instruction to buy/order/purchase a specific item. For browsing, comparisons, or recommendations, describe what you found instead. After calling place_order, its result tells you the exact item, quantity, and total price being proposed — state those clearly and tell the user a confirmation button will appear; do not say the purchase is complete, since it isn't yet.

If any tool result is an error, or place_order reports insufficient balance, NEVER paste the raw error text or JSON back to the user. Instead explain in plain, friendly language what happened and suggest a concrete next step: for insufficient balance, say so plainly and suggest a smaller quantity, a cheaper alternative, or checking their balance; for an item that's no longer available, say it's no longer available and offer to search for something similar.

Prices are in dollars. Be concise and conversational — this is a chat reply, not a report.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_catalogue",
      description:
        "Semantic search over the furniture catalogue (vector similarity, not keyword matching) — describe what the user is looking for in plain language. Returns the closest-matching products ranked by relevance.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Plain-language description of what to search for, e.g. 'cozy blue armchair for a small reading nook'.",
          },
          category: {
            type: "string",
            description: "Exact category name (e.g. 'Chairs', 'Beds') to filter to, only when the user named one explicitly.",
          },
          max_price: {
            type: "number",
            description: "Only return items at or under this price, only when the user gave an explicit numeric limit.",
          },
          limit: {
            type: "integer",
            description: "Max results to return. Default 10.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_product",
      description:
        "Fetch full detail (dimensions, colours, category) for exactly one product by its item_id, from a prior search_catalogue result.",
      parameters: {
        type: "object",
        properties: { item_id: { type: "string" } },
        required: ["item_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_balance",
      description: "Return the user's current account balance as a single snapshot number.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "place_order",
      description:
        "Stage a proposed order for one item_id and quantity for the user to review and confirm. Does NOT charge anything itself. Only call this on an explicit purchase instruction.",
      parameters: {
        type: "object",
        properties: {
          item_id: { type: "string" },
          quantity: { type: "integer", description: "Defaults to 1 if omitted." },
        },
        required: ["item_id"],
      },
    },
  },
];

// place_order is special-cased in the loop below, not dispatched generically —
// it never executes a real purchase itself; it only stages one for the user
// to confirm via a UI button (see ShopAssistant.js), which calls /api/buy
// directly.
const TOOL_IMPLEMENTATIONS = {
  search_catalogue: (input) =>
    vectorSearchProducts({
      query: input.query,
      category: input.category,
      maxPrice: input.max_price,
      limit: input.limit,
    }),
  get_product: (input) => getProduct(input.item_id),
  check_balance: () => checkBalance(),
};

const MAX_TURNS = 8;

export async function runShopAssistant(userMessage) {
  const endpoint = process.env.AZURE_AI_ENDPOINT;
  const apiVersion = process.env.AZURE_AI_API_VERSION;
  const deployment = process.env.AZURE_AI_DEPLOYMENT;
  const apiKey = process.env.AZURE_AI_API_KEY;

  if (!endpoint || !apiVersion || !deployment || !apiKey) {
    const err = new Error("The shop assistant isn't configured yet (see .env.local).");
    err.status = 501;
    throw err;
  }

  const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userMessage },
  ];

  const toolCalls = [];
  let pendingOrder = null;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    let data;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          tools: TOOLS,
          max_completion_tokens: 2000,
          reasoning_effort: "low",
        }),
      });
      data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data?.error?.message ?? `Assistant request failed (status ${res.status}).`;
        const err = new Error(message);
        err.status = res.status;
        throw err;
      }
    } catch (err) {
      if (err.status) throw err;
      const wrapped = new Error("Couldn't reach the shop assistant. Try again shortly.");
      wrapped.status = 502;
      throw wrapped;
    }

    const choice = data.choices?.[0];
    const message = choice?.message;
    if (!message) {
      const err = new Error("The assistant returned an empty response.");
      err.status = 502;
      throw err;
    }

    if (message.tool_calls?.length > 0) {
      messages.push({
        role: "assistant",
        content: message.content,
        tool_calls: message.tool_calls,
      });

      for (const call of message.tool_calls) {
        let input = {};
        try {
          input = JSON.parse(call.function.arguments || "{}");
        } catch {
          input = {};
        }

        let resultContent;
        try {
          if (call.function.name === "place_order") {
            const product = await getProduct(input.item_id);
            const quantity = input.quantity ?? 1;
            const unitPrice = Number(product.price);
            const total = unitPrice * quantity;
            const { balance } = await checkBalance();

            if (total > balance) {
              resultContent = JSON.stringify({
                status: "insufficient_balance",
                item_id: input.item_id,
                name: product.product_name,
                unit_price: unitPrice,
                quantity,
                total,
                balance,
                shortfall: total - balance,
                note: "The user cannot afford this — total exceeds their current balance. Do NOT stage this order (no confirmation card will be shown). Tell them plainly they don't have enough balance for this, mention roughly how much more it costs than they have, and suggest a smaller quantity, a cheaper alternative, or checking their balance — do not show raw numbers/JSON.",
              });
              toolCalls.push({ name: "place_order", input, ok: true, insufficientBalance: true });
            } else {
              pendingOrder = {
                item_id: input.item_id,
                name: product.product_name,
                unit_price: unitPrice,
                quantity,
                total,
              };

              resultContent = JSON.stringify({
                status: "awaiting_confirmation",
                item_id: input.item_id,
                name: product.product_name,
                unit_price: unitPrice,
                quantity,
                total,
                note: "This has NOT been purchased yet. Tell the user exactly what you're about to buy, the quantity, and the total price, and that a confirmation button will appear for them to approve the charge. Do not say the order is placed.",
              });
              toolCalls.push({ name: "place_order", input, ok: true, pending: true });
            }
          } else {
            const impl = TOOL_IMPLEMENTATIONS[call.function.name];
            const result = impl
              ? await impl(input)
              : { error: `Unknown tool: ${call.function.name}` };
            resultContent = JSON.stringify(result);
            toolCalls.push({ name: call.function.name, input, ok: true });
          }
        } catch (toolErr) {
          resultContent = JSON.stringify({ error: toolErr.message });
          toolCalls.push({ name: call.function.name, input, ok: false, error: toolErr.message });
        }

        messages.push({ role: "tool", tool_call_id: call.id, content: resultContent });
      }
      continue;
    }

    return { reply: message.content ?? "", toolCalls, pendingOrder };
  }

  return {
    reply:
      "I wasn't able to finish that within the allotted steps — try rephrasing or breaking it into a simpler request.",
    toolCalls,
    pendingOrder,
  };
}
