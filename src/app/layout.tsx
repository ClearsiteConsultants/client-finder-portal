import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/SessionProvider";

export const metadata: Metadata = {
  title: "Client Finder Portal",
  description: "Lead Discovery and Outreach Management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900 dark:from-slate-950 dark:to-slate-950 dark:text-slate-50">
        <SessionProvider>
          <div className="min-h-screen flex flex-col">
            <div className="flex-1">{children}</div>
            <footer className="border-t border-slate-200/70 dark:border-slate-800">
              <div className="mx-auto max-w-7xl px-4 py-6 text-xs text-slate-500 dark:text-slate-400 sm:px-6 lg:px-8">
                Client Finder Portal
              </div>
            </footer>
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
