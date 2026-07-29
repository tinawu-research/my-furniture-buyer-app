"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import RequireAuth from "@/components/RequireAuth";

function OrdersContent() {
  const { user, session } = useAuth();
  const [orders, setOrders] = useState([]);
  const [balance, setBalance] = useState(null);
  const [balanceError, setBalanceError] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);

    const [ordersRes, balanceRes] = await Promise.all([
      supabase
        .from("orders")
        .select("id, total, created_at, order_items(quantity, price, products(name))")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      fetch("/api/balance", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).then((res) => res.json()),
    ]);

    setOrders(ordersRes.data ?? []);

    if (balanceRes.error) {
      setBalanceError(balanceRes.error);
      setBalance(null);
    } else {
      setBalanceError(null);
      setBalance(balanceRes.balance);
    }

    setLoading(false);
  }, [user, session]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-mount
    loadData();
  }, [loadData]);

  if (loading) return <p className="p-6 text-gray-500">Loading orders...</p>;

  const spent = orders.reduce((sum, o) => sum + Number(o.total), 0);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold mb-4">My Orders</h1>

      <div className="border rounded-lg p-4 mb-6">
        <span className="text-gray-500 text-sm">Balance (from the furniture shop&apos;s API)</span>
        {balanceError ? (
          <p className="text-red-600 mt-1">{balanceError}</p>
        ) : (
          <p className="text-xl font-semibold mt-1">
            $
            {balance.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        )}
      </div>

      <div className="flex items-baseline justify-between mb-6">
        <span className="text-gray-500">
          Total spent across {orders.length} order{orders.length === 1 ? "" : "s"} in
          this app&apos;s own order history
        </span>
        <span className="text-xl font-semibold">
          $
          {spent.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      </div>

      {orders.length === 0 && <p className="text-gray-500">No orders yet.</p>}

      <div className="flex flex-col gap-4">
        {orders.map((order) => (
          <div key={order.id} className="border rounded-lg p-4">
            <div className="flex justify-between text-sm text-gray-500 mb-2">
              <span>{new Date(order.created_at).toLocaleString()}</span>
              <span className="font-medium text-black">
                ${Number(order.total).toFixed(2)}
              </span>
            </div>
            <ul className="text-sm list-disc list-inside">
              {order.order_items.map((item, i) => (
                <li key={i}>
                  {item.quantity} x {item.products?.name} (${Number(item.price).toFixed(2)}{" "}
                  each)
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <RequireAuth>
      <OrdersContent />
    </RequireAuth>
  );
}
