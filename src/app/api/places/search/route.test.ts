/**
 * @jest-environment node
 */

const mockAuth = jest.fn();
const mockFindUnique = jest.fn();
const mockSearch = jest.fn();

jest.mock("@/lib/auth", () => ({
  auth: (...args: any[]) => mockAuth(...args),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: any[]) => mockFindUnique(...args),
    },
  },
}));

jest.mock("@/lib/places/service", () => ({
  PlacesService: jest.fn().mockImplementation(() => ({
    search: (...args: any[]) => mockSearch(...args),
  })),
}));

import { POST } from "./route";

describe("POST /api/places/search", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 and relogin message when session user is stale", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "missing-user-id" },
    });
    mockFindUnique.mockResolvedValueOnce(null);

    const request = new Request("http://localhost/api/places/search", {
      method: "POST",
      body: JSON.stringify({
        location: "84660",
        radius: 1000,
      }),
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe(
      "Unauthorized: session is no longer valid. Please sign in again."
    );
    expect(mockSearch).not.toHaveBeenCalled();
  });
});
