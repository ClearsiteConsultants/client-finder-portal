/**
 * @jest-environment node
 */

import { PlacesClient } from "./client";

const mockPlacesNearby = jest.fn();

jest.mock("@googlemaps/google-maps-services-js", () => ({
  Client: jest.fn().mockImplementation(() => ({
    placesNearby: (...args: unknown[]) => mockPlacesNearby(...args),
    textSearch: jest.fn(),
    placeDetails: jest.fn(),
    geocode: jest.fn(),
  })),
}));

describe("PlacesClient REQUEST_DENIED messaging", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a billing-specific error message when billing is disabled", () => {
    const client = new PlacesClient("test-key") as any;

    const error = client.createError(
      "REQUEST_DENIED",
      "Billing has not been enabled on your account.",
      undefined
    );

    expect(error.code).toBe("INVALID_KEY");
    expect(error.message).toContain("billing is not active");
    expect(error.message).toContain("free trial");
  });

  it("returns an API activation-specific message when API is not activated", () => {
    const client = new PlacesClient("test-key") as any;

    const error = client.createError(
      "REQUEST_DENIED",
      "This API is not activated on your API project.",
      undefined
    );

    expect(error.code).toBe("INVALID_KEY");
    expect(error.message).toContain("Billing may not be active");
    expect(error.message).toContain("Geocoding API");
  });

  it("parses Axios-style 403 errors with code fields into billing-specific messages", async () => {
    const client = new PlacesClient("test-key");

    mockPlacesNearby.mockRejectedValueOnce({
      code: "ERR_BAD_REQUEST",
      message: "Request failed with status code 403",
      response: {
        status: 403,
        data: {
          status: "REQUEST_DENIED",
          error_message: "Billing has not been enabled on your account.",
        },
      },
    });

    await expect(
      client.nearbySearch({ lat: 40.7128, lng: -74.006 }, 1000)
    ).rejects.toMatchObject({
      code: "INVALID_KEY",
      message: expect.stringContaining("billing is not active"),
    });
  });

  it("does not emit [object Object] for non-Axios object errors", async () => {
    const client = new PlacesClient("test-key");

    mockPlacesNearby.mockRejectedValueOnce({
      detail: {
        reason: "upstream unavailable",
      },
    });

    await expect(
      client.nearbySearch({ lat: 40.7128, lng: -74.006 }, 1000)
    ).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      message: expect.stringContaining("upstream unavailable"),
    });
  });
});
