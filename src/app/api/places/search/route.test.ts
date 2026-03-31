/**
 * @jest-environment node
 */

const mockAuth = jest.fn();
const mockFindUnique = jest.fn();
const mockSearch = jest.fn();
const mockCheckBusinessTypeExclusion = jest.fn();

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

jest.mock("@/lib/scoring/exclusions", () => ({
  checkBusinessTypeExclusion: (...args: any[]) => mockCheckBusinessTypeExclusion(...args),
}));

import { POST } from "./route";

describe("POST /api/places/search", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckBusinessTypeExclusion.mockResolvedValue({ isExcluded: false });
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

  it("returns 400 when requested business type is excluded", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-id" },
    });
    mockFindUnique.mockResolvedValueOnce({ id: "user-id" });
    mockCheckBusinessTypeExclusion.mockResolvedValueOnce({ isExcluded: true });

    const request = new Request("http://localhost/api/places/search", {
      method: "POST",
      body: JSON.stringify({
        location: "84660",
        radius: 1000,
        businessType: "restaurant",
      }),
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Business type "restaurant" is excluded and cannot be searched.');
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("returns 400 when searchBy has an unsupported value", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-id" },
    });
    mockFindUnique.mockResolvedValueOnce({ id: "user-id" });

    const request = new Request("http://localhost/api/places/search", {
      method: "POST",
      body: JSON.stringify({
        searchBy: "unknown",
        location: "84660",
        radius: 1000,
      }),
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('searchBy must be either "location" or "business_name"');
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("returns 400 when business_name search has empty query", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-id" },
    });
    mockFindUnique.mockResolvedValueOnce({ id: "user-id" });

    const request = new Request("http://localhost/api/places/search", {
      method: "POST",
      body: JSON.stringify({
        searchBy: "business_name",
        businessName: "   ",
        location: "Austin, TX",
        radius: 1000,
      }),
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Business name is required");
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("returns 400 when business_name search has no location", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-id" },
    });
    mockFindUnique.mockResolvedValueOnce({ id: "user-id" });

    const request = new Request("http://localhost/api/places/search", {
      method: "POST",
      body: JSON.stringify({
        searchBy: "business_name",
        businessName: "Acme Plumbing",
        location: "   ",
        radius: 1000,
      }),
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Location is required for business name searches");
    expect(mockSearch).not.toHaveBeenCalled();
  });
});
