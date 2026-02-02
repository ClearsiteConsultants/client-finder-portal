import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SearchForm from "../SearchForm";

// Mock fetch
global.fetch = jest.fn();

describe("SearchForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders search form with all required inputs", () => {
    render(<SearchForm />);

    expect(screen.getByLabelText(/location/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/search radius/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/business type/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /search businesses/i })).toBeInTheDocument();
  });

  it("requires location to be filled", async () => {
    render(<SearchForm />);

    const submitButton = screen.getByRole("button", { name: /search businesses/i });
    fireEvent.click(submitButton);

    // The form should prevent submission if location is empty
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("validates that radius is required and valid", () => {
    render(<SearchForm />);

    const radiusSelect = screen.getByLabelText(/search radius/i) as HTMLSelectElement;
    expect(radiusSelect.value).toBe("5000"); // Default value
    expect(radiusSelect.required).toBe(true);
  });

  it("rejects invalid location (empty string)", async () => {
    render(<SearchForm />);

    const locationInput = screen.getByLabelText(/location/i);
    const submitButton = screen.getByRole("button", { name: /search businesses/i });

    // Try to submit with empty location
    fireEvent.change(locationInput, { target: { value: "" } });
    fireEvent.click(submitButton);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("submits form with valid data", async () => {
    const mockResponse = {
      status: "success",
      results: [
        {
          placeId: "test-1",
          name: "Test Business",
          address: "123 Test St",
          lat: 40.7128,
          lng: -74.006,
          hasWebsite: true,
          isNew: true,
          businessTypes: ["restaurant"],
        },
      ],
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    render(<SearchForm />);

    const locationInput = screen.getByLabelText(/location/i);
    const radiusSelect = screen.getByLabelText(/search radius/i);
    const submitButton = screen.getByRole("button", { name: /search businesses/i });

    fireEvent.change(locationInput, { target: { value: "New York, NY" } });
    fireEvent.change(radiusSelect, { target: { value: "10000" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/places/search",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            location: "New York, NY",
            radius: 10000,
            businessType: undefined,
          }),
        })
      );
    });
  });

  it("displays error message when API returns error", async () => {
    const errorMessage = "Invalid location provided";
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: errorMessage }),
    });

    render(<SearchForm />);

    const locationInput = screen.getByLabelText(/location/i);
    const submitButton = screen.getByRole("button", { name: /search businesses/i });

    fireEvent.change(locationInput, { target: { value: "Invalid Location" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it("displays loading state during search", async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({ status: "success", results: [] }),
              }),
            100
          )
        )
    );

    render(<SearchForm />);

    const locationInput = screen.getByLabelText(/location/i);
    const submitButton = screen.getByRole("button", { name: /search businesses/i });

    fireEvent.change(locationInput, { target: { value: "New York" } });
    fireEvent.click(submitButton);

    expect(screen.getByRole("button", { name: /searching/i })).toBeDisabled();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /search businesses/i })).toBeEnabled();
    });
  });

  it("handles network errors gracefully", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

    render(<SearchForm />);

    const locationInput = screen.getByLabelText(/location/i);
    const submitButton = screen.getByRole("button", { name: /search businesses/i });

    fireEvent.change(locationInput, { target: { value: "Test Location" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });
});
