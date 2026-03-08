import { render, screen } from "@testing-library/react";
import LoginPage from "./page";

const mockPush = jest.fn();
const mockRefresh = jest.fn();
const mockGet = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  useSearchParams: () => ({
    get: mockGet,
  }),
}));

jest.mock("next-auth/react", () => ({
  signIn: jest.fn(),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockReturnValue(null);
  });

  it("shows stale-session message when redirected with session_invalid", () => {
    mockGet.mockImplementation((key: string) =>
      key === "error" ? "session_invalid" : null
    );

    render(<LoginPage />);

    expect(
      screen.getByText("Your session is no longer valid. Please sign in again.")
    ).toBeInTheDocument();
  });

  it("does not show stale-session message by default", () => {
    render(<LoginPage />);

    expect(
      screen.queryByText("Your session is no longer valid. Please sign in again.")
    ).not.toBeInTheDocument();
  });
});
