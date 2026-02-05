"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

import SignOutButton from "@/components/SignOutButton";

type NavItem = {
  href: string;
  label: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Search" },
  { href: "/review", label: "Review" },
  { href: "/clients", label: "Active Clients" },
  { href: "/exclusions", label: "Exclusions" },
];

function isActivePath(currentPath: string, href: string) {
  if (href === "/") return currentPath === "/";
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export default function TopNav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/75 backdrop-blur dark:border-slate-800 dark:bg-slate-950/60">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-sm"
              aria-hidden="true"
            />
            <div className="leading-tight">
              <div className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                Client Finder Portal
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Lead discovery and outreach management
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <nav className="hidden items-center gap-1 sm:flex">
              {NAV_ITEMS.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                      active
                        ? "bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-slate-50"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-50"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <span className="hidden text-sm text-slate-600 dark:text-slate-300 md:inline">
                  {session?.user?.email}
                </span>
                <SignOutButton />
              </div>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>

        <nav className="mt-3 flex items-center gap-1 sm:hidden">
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex-1 rounded-lg px-3 py-2 text-center text-sm font-semibold transition-colors ${
                  active
                    ? "bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-slate-50"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-slate-50"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
