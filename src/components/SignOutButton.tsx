"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="theme-surface theme-border theme-text-muted inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm font-semibold shadow-sm hover:bg-rose-50 hover:text-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-200"
    >
      Sign out
    </button>
  );
}
