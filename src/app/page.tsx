import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/SignOutButton";

export default async function Home() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">QuizMaster Pro</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              Signed in as {session.user?.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-4xl font-bold mb-4">
            Welcome to QuizMaster Pro
          </h2>
          <p className="text-xl text-gray-600">
            Professional Quiz Management Application
          </p>
          <p className="mt-4 text-gray-500">
            You are authenticated and ready to use the application.
          </p>
        </div>
      </main>
    </div>
  );
}

