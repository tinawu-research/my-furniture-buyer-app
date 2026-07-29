"use client";

import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

export default function Navbar() {
  const { user, signOut } = useAuth();

  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b bg-white">
      <Link href="/" className="font-semibold text-lg">
        Furniture Buyer
      </Link>
      <div className="flex items-center gap-4 text-sm">
        <Link href="/catalogue" className="hover:underline">
          Catalogue
        </Link>
        {user && (
          <Link href="/orders" className="hover:underline">
            My Orders
          </Link>
        )}
        {user ? (
          <>
            <span className="text-gray-500">{user.email}</span>
            <button
              onClick={signOut}
              className="rounded bg-gray-100 px-3 py-1 hover:bg-gray-200"
            >
              Log out
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="rounded bg-black text-white px-3 py-1 hover:bg-gray-800"
          >
            Log in
          </Link>
        )}
      </div>
    </nav>
  );
}
