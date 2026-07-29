"use client";

import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="text-4xl font-bold mb-4">Furniture Buyer</h1>
      <p className="text-gray-600 mb-8">
        Browse our furniture catalogue and place orders against your budget.
      </p>
      <Link
        href={user ? "/catalogue" : "/login"}
        className="inline-block rounded bg-black text-white px-6 py-3 hover:bg-gray-800"
      >
        {user ? "Go to catalogue" : "Log in to get started"}
      </Link>
    </div>
  );
}
