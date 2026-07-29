// Shop assistant: a tool-calling agent backed by an Azure-hosted GPT-5 mini
// deployment (chosen over Claude for this feature — see CLAUDE.md). Server
// only: AZURE_AI_API_KEY must never reach the browser.
//
// GPT-5 mini is a reasoning model — omitting reasoning_effort or leaving
// max_completion_tokens too low means every token gets spent on invisible
// reasoning and the response comes back empty (confirmed by testing
// directly against the endpoint). "low" effort plus a few thousand tokens
// is comfortably enough for this assistant's tasks.

import { searchCatalogue, getProduct, checkBalance } from "@/lib/externalApi";

const SYSTEM_PROMPT = `You are a shopping assistant for a furniture shop. You have four tools, each calling a real external API:

- search_catalogue: lists products, filterable ONLY by an exact category name, with limit/skip pagination. The API itself has no price range, colour, or keyword/text search.
- get_product: full detail for one specific item you already have the item_id for (from a prior search_catalogue call). Not for browsing.
- check_balance: the user's real, current account balance. A snapshot number only, no transaction history.
- place_order: stages a proposed purchase (item_id + quantity) for the user to confirm — it does NOT charge anything by itself. Once the user confirms (through a UI button, not by replying to you), the purchase executes immediately and cannot be undone.

When a request needs judgement the API can't do itself — "cheap", a colour, a vibe, "under $X" — fetch a reasonably wide set of plain results yourself via search_catalogue (raise limit if needed) and apply that judgement over the returned fields (price, colours, product_name, category) yourself. Never assume the API understands these concepts; it only filters by exact category name.

Only call place_order when the user has given an explicit, unambiguous instruction to buy/order/purchase a specific item. For browsing, comparisons, or recommendations, describe what you found instead. After calling place_order, its result tells you the exact item, quantity, and total price being proposed — state those clearly and tell the user a confirmation button will appear; do not say the purchase is complete, since it isn't yet.

Prices are in dollars. Be concise and conversational — this is a chat reply, not a report.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_catalogue",
      description:
        "List furniture products, optionally filtered to one exact category name, with limit/skip pagination. No price, colour, or keyword filtering in the API itself — fetch broadly and filter yourself for those.",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description: "Exact category name (e.g. 'Chairs', 'Beds'). Omit to list across all categories.",
          },
          limit: {
            type: "integer",
            description: "Max results to return. Default 20 — raise it (e.g. 100+) when you need enough data to judge/filter yourself.",
          },
          skip: { type: "integer", description: "Number of results to skip, for pagination." },
        },
        required: [],
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
    searchCatalogue({ category: input.category, limit: input.limit, skip: input.skip }),
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
