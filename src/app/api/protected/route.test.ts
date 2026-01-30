/**
 * @jest-environment node
 */

describe("/api/protected", () => {
  it("should return 401 when user is not authenticated", async () => {
    // Mock the auth function to return null
    jest.doMock("@/lib/auth", () => ({
      auth: jest.fn().mockResolvedValue(null),
    }));

    const { GET } = await import("@/app/api/protected/route");
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: "Unauthorized" });
  });

  it("should return user data when authenticated", async () => {
    // Mock the auth function to return a session
    jest.doMock("@/lib/auth", () => ({
      auth: jest.fn().mockResolvedValue({
        user: {
          id: "123",
          email: "test@example.com",
          name: "Test User",
        },
        expires: "2024-12-31",
      }),
    }));

    const { GET } = await import("@/app/api/protected/route");
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty("message", "This is a protected route");
    expect(data.user).toHaveProperty("email", "test@example.com");
  });
});
