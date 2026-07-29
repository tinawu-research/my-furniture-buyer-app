"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import RequireAuth from "@/components/RequireAuth";
import KuromiMascot from "@/components/KuromiMascot";

function OrdersContent() {
  const { session } = useAuth();
  const [orders, setOrders] = useState([]);
  const [ordersError, setOrdersError] = useState(null);
  const [balance, setBalance] = useState(null);
  const [balanceError, setBalanceError] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);

    const authHeader = { Authorization: `Bearer ${session.access_token}` };
    const [ordersRes, balanceRes] = await Promise.all([
      fetch("/api/order-history", { headers: authHeader }).then((res) => res.json()),
      fetch("/api/balance", { headers: authHeader }).then((res) => res.json()),
    ]);

    if (ordersRes.error) {
      setOrdersError(ordersRes.error);
      setOrders([]);
    } else {
      setOrdersError(null);
      // Newest first.
      setOrders(
        [...ordersRes.orders].sort(
          (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
        )
      );
    }

    if (balanceRes.error) {
      setBalanceError(balanceRes.error);
      setBalance(null);
    } else {
      setBalanceError(null);
      setBalance(balanceRes.balance);
    }

    setLoading(false);
  }, [session]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-mount
    loadData();
  }, [loadData]);

  if (loading) return <p className="p-6 text-[var(--ink-soft)] font-bold">Loading orders... 🎀</p>;

  const spent = orders.reduce((sum, o) => sum + Number(o.total_amount), 0);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center gap-2 mb-4">
        <KuromiMascot size={40} />
        <h1 className="font-heading text-3xl font-extrabold">My Orders</h1>
      </div>

      <div className="kuromi-card p-4 mb-6">
        <span className="text-[var(--ink-soft)] text-sm font-bold">
          Balance (from the furniture shop&apos;s API)
        </span>
        {balanceError ? (
          <p className="text-[var(--pink-dark)] font-bold mt-1">{balanceError}</p>
        ) : (
          <p className="kuromi-price text-2xl font-extrabold mt-1">
            $
            {balance.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        )}
      </div>

      {ordersError ? (
        <p className="text-[var(--pink-dark)] font-bold mb-6">{ordersError}</p>
      ) : (
        <div className="kuromi-card-pink flex items-baseline justify-between mb-6 px-4 py-3">
          <span className="text-[var(--ink-soft)] font-bold">
            {`Total spent across ${orders.length} order${orders.length === 1 ? "" : "s"}`}
          </span>
          <span className="kuromi-price text-xl font-extrabold">
            $
            {spent.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
      )}

      {!ordersError && orders.length === 0 && (
        <p className="text-[var(--ink-soft)] font-bold">No orders yet.</p>
      )}

      <div className="flex flex-col gap-4">
        {orders.map((order) => (
          <div key={order.order_id} className="kuromi-card p-4">
            <div className="flex justify-between text-sm text-[var(--ink-soft)] mb-2">
              <span>{new Date(order.timestamp).toLocaleString()}</span>
              <span className="kuromi-price font-extrabold">
                ${Number(order.total_amount).toFixed(2)}
              </span>
            </div>
            <ul className="text-sm list-disc list-inside">
              {order.items.map((item, i) => (
                <li key={i}>
                  {item.quantity} x {item.product_name} (${Number(item.unit_price).toFixed(2)}{" "}
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
