/**
 * @jest-environment node
 */

const mockAuth = jest.fn();

jest.mock('@/lib/auth', () => ({
  auth: (...args: any[]) => mockAuth(...args),
}));

import { GET } from './route';

describe("/api/protected", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 401 when user is not authenticated", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: "Unauthorized" });
  });

  it("should return user data when authenticated", async () => {
    mockAuth.mockResolvedValueOnce({
      user: {
        id: "123",
        email: "test@example.com",
        name: "Test User",
      },
      expires: "2024-12-31",
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("message", "This is a protected route");
    expect(data.user).toHaveProperty("email", "test@example.com");
  });
});
