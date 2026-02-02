import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import SearchForm from "@/components/search/SearchForm";

export default async function SearchPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
            Business Discovery Search
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Search for local businesses and add them to your lead list
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <SearchForm />
      </main>
    </div>
  );
}
