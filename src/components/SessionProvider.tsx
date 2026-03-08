"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { useEffect, useRef } from "react";

function SessionInvalidationWatcher() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const didSignOut = useRef(false);

  useEffect(() => {
    if (didSignOut.current) {
      return;
    }

    if (session?.error === "SessionInvalid") {
      didSignOut.current = true;
      void signOut({ callbackUrl: "/login?error=session_invalid" });
    }
  }, [session, pathname]);

  return null;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  return (
    <NextAuthSessionProvider>
      <SessionInvalidationWatcher />
      {children}
    </NextAuthSessionProvider>
  );
}
