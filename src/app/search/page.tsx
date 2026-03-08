import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import SearchForm from "@/components/search/SearchForm";
import TopNav from "@/components/TopNav";

export default async function SearchPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <TopNav />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">
            Business Discovery Search
          </h1>
          <p className="theme-text-muted mt-1 text-sm">
            Search for local businesses and add them to your lead list
          </p>
        </div>
        <SearchForm />
      </main>
    </div>
  );
}
