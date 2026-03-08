import { render, waitFor } from "@testing-library/react";
import { SessionProvider } from "./SessionProvider";

const mockUseSession = jest.fn();
const mockSignOut = jest.fn();

jest.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSession: () => mockUseSession(),
  signOut: (...args: any[]) => mockSignOut(...args),
}));

jest.mock("next/navigation", () => ({
  usePathname: () => "/search",
}));

describe("SessionProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("automatically signs out when session is invalid", async () => {
    mockUseSession.mockReturnValue({
      data: { error: "SessionInvalid" },
    });

    render(
      <SessionProvider>
        <div>content</div>
      </SessionProvider>
    );

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledWith({
        callbackUrl: "/login?error=session_invalid",
      });
    });
  });

  it("does not sign out when session is valid", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "123" } },
    });

    render(
      <SessionProvider>
        <div>content</div>
      </SessionProvider>
    );

    await waitFor(() => {
      expect(mockSignOut).not.toHaveBeenCalled();
    });
  });
});
