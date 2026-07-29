"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import ProductCard from "@/components/ProductCard";
import BudgetTracker from "@/components/BudgetTracker";

export default function Home() {
  const { user, session } = useAuth();
  const [products, setProducts] = useState([]);
  const [budget, setBudget] = useState(0);
  const [spent, setSpent] = useState(0);
  const [cart, setCart] = useState({}); // productId -> quantity
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [placingOrder, setPlacingOrder] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);

    const productsRes = await supabase.from("products").select("*").order("name");
    if (productsRes.error) setError(productsRes.error.message);
    setProducts(productsRes.data ?? []);

    if (user) {
      const [profileRes, ordersRes] = await Promise.all([
        supabase.from("profiles").select("budget").eq("id", user.id).single(),
        supabase.from("orders").select("total").eq("user_id", user.id),
      ]);
      setBudget(profileRes.data?.budget ?? 0);
      setSpent((ordersRes.data ?? []).reduce((sum, o) => sum + Number(o.total), 0));
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-mount
    loadData();
  }, [loadData]);

  const cartEntries = Object.entries(cart).filter(([, qty]) => qty > 0);
  const cartTotal = cartEntries.reduce((sum, [productId, qty]) => {
    const product = products.find((p) => p.id === productId);
    return sum + (product ? Number(product.price) * qty : 0);
  }, 0);
  const remainingBudget = budget - spent;
  const overBudget = cartTotal > remainingBudget;

  async function placeOrder() {
    if (overBudget) return;

    setError(null);
    setMessage(null);
    setPlacingOrder(true);

    const items = cartEntries.map(([product_id, quantity]) => ({
      product_id,
      quantity,
    }));

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ items }),
    });
    const body = await res.json();
    setPlacingOrder(false);

    if (!res.ok) {
      setError(body.error ?? "Something went wrong placing the order.");
      return;
    }

    setMessage("Order placed!");
    setCart({});
    loadData();
  }

  if (loading) return <p className="p-6 text-gray-500">Loading catalogue...</p>;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold mb-1">Furniture Catalogue</h1>
      <p className="text-gray-500 mb-6">
        Demo products for now — a real catalogue will replace these later.
      </p>

      {user ? (
        <div className="mb-6">
          <BudgetTracker budget={budget} spent={spent} pending={cartTotal} />
        </div>
      ) : (
        <p className="mb-6 text-sm text-gray-600">
          <Link href="/login" className="underline font-medium">
            Log in
          </Link>{" "}
          to place an order.
        </p>
      )}

      {error && <p className="text-red-600 mb-4">{error}</p>}
      {message && <p className="text-green-600 mb-4">{message}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-8">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            quantity={cart[product.id] ?? 0}
            onQuantityChange={(qty) =>
              setCart((prev) => ({ ...prev, [product.id]: qty }))
            }
          />
        ))}
      </div>

      {cartEntries.length > 0 && (
        <div className="sticky bottom-4 border rounded-lg bg-white shadow p-4">
          <div className="flex items-center justify-between">
            <span>
              {cartEntries.length} item(s) — ${cartTotal.toFixed(2)}
            </span>
            {user ? (
              <button
                onClick={placeOrder}
                disabled={placingOrder || overBudget}
                className="rounded bg-black text-white px-4 py-2 hover:bg-gray-800 disabled:opacity-50"
              >
                {placingOrder ? "Placing order..." : "Place order"}
              </button>
            ) : (
              <Link
                href="/login"
                className="rounded bg-black text-white px-4 py-2 hover:bg-gray-800"
              >
                Log in to order
              </Link>
            )}
          </div>
          {user && overBudget && (
            <p className="text-sm text-red-600 mt-2">
              This order is ${(cartTotal - remainingBudget).toFixed(2)} over your
              remaining budget — remove an item to continue.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
