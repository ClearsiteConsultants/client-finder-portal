import { auth } from "@/lib/auth";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import HealthStatus from "@/components/HealthStatus";

export default async function Home() {
  const session = await auth();
  const isAuthenticated = !!session?.user;

  return (
    <div className="flex flex-col">
      <header className="theme-surface theme-border sticky top-0 z-10 border-b backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-sm" aria-hidden="true" />
            <div className="leading-tight">
              <h1 className="text-base font-semibold tracking-tight">
                Client Finder Portal
              </h1>
              <p className="theme-text-muted text-xs">
                Lead discovery and outreach management
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <span className="theme-text-muted hidden text-sm sm:inline">
                  {session.user?.email}
                </span>
                <SignOutButton />
              </>
            ) : (
              <Link
                href="/login"
                className="theme-text-muted inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-900"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <section className="theme-surface theme-border relative overflow-hidden rounded-2xl border p-8 shadow-sm sm:p-10">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100/60 via-white to-white dark:from-blue-500/10 dark:via-slate-950 dark:to-slate-950" />
            <div className="max-w-3xl">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Find prospects faster. Track outreach smarter.
              </h2>
                  <p className="theme-text-muted mt-3 text-base sm:text-lg">
                    Discover local businesses, manage leads, and keep outreach organized — all in one place.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                {!isAuthenticated ? (
                  <Link
                    href="/login"
                    className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    Get started
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/search"
                      className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                      Start Searching
                    </Link>
                    <Link
                      href="/review"
                      className="theme-text-muted inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-900"
                    >
                      Review Queue
                    </Link>
                  </>
                )}
                <a
                  href="#health"
                  className="theme-text-muted inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-900"
                >
                  Check system status
                </a>
              </div>
            </div>
          </section>

          <section className="mt-10">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="theme-surface theme-border rounded-2xl border p-6 shadow-sm">
                <div className="text-sm font-semibold">
                  Lead discovery
                </div>
                <p className="theme-text-muted mt-2 text-sm leading-6">
                  Search for businesses and build a focused lead list quickly.
                </p>
              </div>
              <div className="theme-surface theme-border rounded-2xl border p-6 shadow-sm">
                <div className="text-sm font-semibold">
                  Contact management
                </div>
                <p className="theme-text-muted mt-2 text-sm leading-6">
                  Keep contact info organized and easy to reference.
                </p>
              </div>
              <div className="theme-surface theme-border rounded-2xl border p-6 shadow-sm">
                <div className="text-sm font-semibold">
                  Outreach tracking
                </div>
                <p className="theme-text-muted mt-2 text-sm leading-6">
                  Track follow-ups and outcomes with a simple workflow.
                </p>
              </div>
            </div>
          </section>

          <section id="health" className="mt-10">
            <div className="mx-auto max-w-2xl">
              <HealthStatus isAuthenticated={isAuthenticated} />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

