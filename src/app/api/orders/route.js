import { createClient } from "@supabase/supabase-js";

function supabaseForRequest(request) {
  const authHeader = request.headers.get("Authorization") ?? "";
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: authHeader } } }
  );
}

export async function POST(request) {
  const supabase = supabaseForRequest(request);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { items } = await request.json();
  if (!Array.isArray(items) || items.length === 0) {
    return Response.json({ error: "No items in order" }, { status: 400 });
  }

  const productIds = items.map((item) => item.product_id);
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, price")
    .in("id", productIds);

  if (productsError) {
    return Response.json({ error: productsError.message }, { status: 500 });
  }

  const priceById = Object.fromEntries(products.map((p) => [p.id, Number(p.price)]));
  const orderTotal = items.reduce((sum, item) => {
    const price = priceById[item.product_id];
    if (price === undefined) return sum;
    return sum + price * item.quantity;
  }, 0);

  const [{ data: profile, error: profileError }, { data: pastOrders, error: pastOrdersError }] =
    await Promise.all([
      supabase.from("profiles").select("budget").eq("id", user.id).single(),
      supabase.from("orders").select("total").eq("user_id", user.id),
    ]);

  if (profileError || pastOrdersError) {
    return Response.json(
      { error: (profileError ?? pastOrdersError).message },
      { status: 500 }
    );
  }

  const alreadySpent = pastOrders.reduce((sum, o) => sum + Number(o.total), 0);
  const remaining = Number(profile.budget) - alreadySpent;

  if (orderTotal > remaining) {
    return Response.json(
      {
        error: `Order total $${orderTotal.toFixed(2)} exceeds your remaining budget of $${remaining.toFixed(2)}.`,
      },
      { status: 400 }
    );
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({ user_id: user.id, total: orderTotal })
    .select()
    .single();

  if (orderError) {
    return Response.json({ error: orderError.message }, { status: 500 });
  }

  const orderItems = items
    .filter((item) => priceById[item.product_id] !== undefined)
    .map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      price: priceById[item.product_id],
    }));

  const { error: itemsError } = await supabase.from("order_items").insert(orderItems);

  if (itemsError) {
    return Response.json({ error: itemsError.message }, { status: 500 });
  }

  return Response.json({ order }, { status: 201 });
}
