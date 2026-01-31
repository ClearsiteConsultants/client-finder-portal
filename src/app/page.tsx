import { auth } from "@/lib/auth";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import HealthStatus from "@/components/HealthStatus";

export default async function Home() {
  const session = await auth();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Client Finder Portal
          </h1>
          <div className="flex items-center gap-4">
            {session ? (
              <>
                <span className="text-sm text-gray-600">
                  {session.user?.email}
                </span>
                <SignOutButton />
              </>
            ) : (
              <Link
                href="/login"
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4 text-gray-900">
              Welcome to Client Finder Portal
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Discover local businesses, manage leads, and track outreach
              campaigns - all in one place.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 mb-12">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold mb-2">Lead Discovery</h3>
              <p className="text-gray-600 text-sm">
                Search and discover potential clients using Google Places API
                integration.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold mb-2">Contact Management</h3>
              <p className="text-gray-600 text-sm">
                Store and organize contact information for all your leads in one
                place.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold mb-2">Outreach Tracking</h3>
              <p className="text-gray-600 text-sm">
                Track all communication attempts and manage email campaigns
                effectively.
              </p>
            </div>
          </div>

          <div className="max-w-2xl mx-auto">
            <HealthStatus isAuthenticated={!!session} />
          </div>

          {!session && (
            <div className="text-center mt-8">
              <Link
                href="/login"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

