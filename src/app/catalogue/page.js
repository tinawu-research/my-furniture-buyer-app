"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import RequireAuth from "@/components/RequireAuth";
import ProductCard from "@/components/ProductCard";
import BudgetTracker from "@/components/BudgetTracker";

function CatalogueContent() {
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
    const [productsRes, profileRes, ordersRes] = await Promise.all([
      supabase.from("products").select("*").order("name"),
      supabase.from("profiles").select("budget").eq("id", user.id).single(),
      supabase.from("orders").select("total").eq("user_id", user.id),
    ]);

    if (productsRes.error) setError(productsRes.error.message);
    setProducts(productsRes.data ?? []);
    setBudget(profileRes.data?.budget ?? 0);
    setSpent((ordersRes.data ?? []).reduce((sum, o) => sum + Number(o.total), 0));
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

  async function placeOrder() {
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
      <h1 className="text-2xl font-bold mb-4">Catalogue</h1>

      <div className="mb-6">
        <BudgetTracker budget={budget} spent={spent} pending={cartTotal} />
      </div>

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
        <div className="sticky bottom-4 border rounded-lg bg-white shadow p-4 flex items-center justify-between">
          <span>
            {cartEntries.length} item(s) — ${cartTotal.toFixed(2)}
          </span>
          <button
            onClick={placeOrder}
            disabled={placingOrder}
            className="rounded bg-black text-white px-4 py-2 hover:bg-gray-800 disabled:opacity-50"
          >
            {placingOrder ? "Placing order..." : "Place order"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function CataloguePage() {
  return (
    <RequireAuth>
      <CatalogueContent />
    </RequireAuth>
  );
}
