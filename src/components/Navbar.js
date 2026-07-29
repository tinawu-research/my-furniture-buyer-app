"use client";

import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

export default function Navbar() {
  const { user, signOut } = useAuth();

  return (
    <nav className="flex items-center justify-between px-6 py-3 border-b-[3px] border-[var(--ink)] bg-gradient-to-r from-[var(--ink)] via-[var(--purple)] to-[var(--ink)]">
      <Link
        href="/"
        className="flex items-center gap-2 font-heading text-xl font-extrabold text-[var(--pink)]"
      >
        <span aria-hidden>🎀</span>
        Furniture Buyer
        <span aria-hidden>💀</span>
      </Link>
      <div className="flex items-center gap-3 text-sm">
        {user && (
          <Link
            href="/orders"
            className="font-heading font-bold text-[var(--pink-light)] hover:text-white"
          >
            My Orders
          </Link>
        )}
        {user ? (
          <>
            <span className="hidden sm:inline text-[var(--pink-light)]/70">{user.email}</span>
            <button onClick={signOut} className="kuromi-btn kuromi-btn-secondary px-3 py-1 text-sm">
              Log out
            </button>
          </>
        ) : (
          <Link href="/login" className="kuromi-btn kuromi-btn-primary px-4 py-1.5 text-sm inline-block">
            Log in
          </Link>
        )}
      </div>
    </nav>
  );
}
