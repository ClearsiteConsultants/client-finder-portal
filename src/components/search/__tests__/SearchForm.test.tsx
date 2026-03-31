import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SearchForm from "../SearchForm";
import { BUSINESS_TYPE_OPTIONS_UPDATED_EVENT } from "@/lib/places/business-type-sync";

// Mock fetch
global.fetch = jest.fn();

async function renderSearchForm() {
  render(<SearchForm />);

  // Wait for async business-type bootstrap to settle to avoid act warnings.
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/places/business-types?forSearch=true",
      expect.objectContaining({ cache: "no-store" })
    );
  });
}

async function openBusinessTypeDropdown() {
  const toggleButton = screen.getByRole("button", { name: /business type/i });
  fireEvent.click(toggleButton);
  await waitFor(() => {
    expect(toggleButton).toHaveAttribute("aria-expanded", "true");
  });
}

describe("SearchForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ businessTypes: [] }),
    });
  });

  it("renders search form with all required inputs", async () => {
    await renderSearchForm();

    expect(screen.getByLabelText(/search by/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/location/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/search radius/i)).toBeInTheDocument();
    expect(screen.getByText(/^business type$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /business type/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/max businesses per search/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /search businesses/i })).toBeInTheDocument();
  });

  it("switches the primary input label between Location and Business Name", async () => {
    await renderSearchForm();

    const searchBySelect = screen.getByLabelText(/search by/i);
    expect(screen.getByLabelText(/^location$/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/city, zip code, or address/i)).toBeInTheDocument();

    fireEvent.change(searchBySelect, { target: { value: "business_name" } });

    expect(screen.getByLabelText(/business name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^location$/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/business name/i)).toBeInTheDocument();
  });

  it("requires location to be filled", async () => {
    await renderSearchForm();

    const submitButton = screen.getByRole("button", { name: /search businesses/i });
    fireEvent.click(submitButton);

    // The form should prevent submission if location is empty
    const fetchCalls = (global.fetch as jest.Mock).mock.calls;
    const searchCall = fetchCalls.find(([url]) => url === "/api/places/search");
    expect(searchCall).toBeUndefined();
  });

  it("validates that radius is required and valid", async () => {
    await renderSearchForm();

    const radiusSelect = screen.getByLabelText(/search radius/i) as HTMLSelectElement;
    expect(radiusSelect.value).toBe("5000"); // Default value
    expect(radiusSelect.required).toBe(true);
  });

  it("opens search radius dropdown on Enter without submitting", async () => {
    await renderSearchForm();

    const radiusSelect = screen.getByLabelText(/search radius/i) as HTMLSelectElement;
    const clickSpy = jest.spyOn(radiusSelect, "click").mockImplementation(() => undefined);

    fireEvent.keyDown(radiusSelect, { key: "Enter" });

    expect(clickSpy).toHaveBeenCalledTimes(1);
    const fetchCalls = (global.fetch as jest.Mock).mock.calls;
    const searchCall = fetchCalls.find(([url]) => url === "/api/places/search");
    expect(searchCall).toBeUndefined();

    clickSpy.mockRestore();
  });

  it("toggles business type checkbox without submitting", async () => {
    await renderSearchForm();
    await openBusinessTypeDropdown();

    (global.fetch as jest.Mock).mockClear();
    const selectAllCheckbox = screen.getByLabelText(/^all$/i) as HTMLInputElement;
    fireEvent.click(selectAllCheckbox);

    const fetchCalls = (global.fetch as jest.Mock).mock.calls;
    const searchCall = fetchCalls.find(([url]) => url === "/api/places/search");
    expect(searchCall).toBeUndefined();
  });

  it("uses Enter on a focused business type to select and deselect without submitting", async () => {
    (global.fetch as jest.Mock).mockImplementation(async (url: RequestInfo | URL) => {
      if (String(url).startsWith("/api/places/business-types")) {
        return {
          ok: true,
          json: async () => ({ businessTypes: ["doctor", "restaurant"] }),
        };
      }

      return {
        ok: true,
        json: async () => ({ status: "success", results: [] }),
      };
    });

    await renderSearchForm();
    await openBusinessTypeDropdown();

    (global.fetch as jest.Mock).mockClear();

    const doctorCheckbox = screen.getByLabelText("Doctor") as HTMLInputElement;
    expect(doctorCheckbox.checked).toBe(true);

    fireEvent.keyDown(doctorCheckbox, { key: "Enter" });
    expect(doctorCheckbox.checked).toBe(false);

    fireEvent.keyDown(doctorCheckbox, { key: "Enter" });
    expect(doctorCheckbox.checked).toBe(true);

    const fetchCalls = (global.fetch as jest.Mock).mock.calls;
    const searchCall = fetchCalls.find(([url]) => url === "/api/places/search");
    expect(searchCall).toBeUndefined();
  });

  it("closes business type dropdown when Escape is pressed", async () => {
    await renderSearchForm();
    const toggleButton = screen.getByRole("button", { name: /business type/i });

    fireEvent.click(toggleButton);
    await waitFor(() => {
      expect(toggleButton).toHaveAttribute("aria-expanded", "true");
    });

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(toggleButton).toHaveAttribute("aria-expanded", "false");
    });
    expect(document.activeElement).toBe(toggleButton);
  });

  it("moves focus through business type checkboxes with arrow keys and toggles with Enter", async () => {
    (global.fetch as jest.Mock).mockImplementation(async (url: RequestInfo | URL) => {
      if (String(url).startsWith("/api/places/business-types")) {
        return {
          ok: true,
          json: async () => ({ businessTypes: ["doctor", "restaurant"] }),
        };
      }

      return {
        ok: true,
        json: async () => ({ status: "success", results: [] }),
      };
    });

    await renderSearchForm();
    await openBusinessTypeDropdown();

    const selectAllCheckbox = screen.getByLabelText(/^all$/i) as HTMLInputElement;
    const doctorCheckbox = screen.getByLabelText("Doctor") as HTMLInputElement;
    const restaurantCheckbox = screen.getByLabelText("Restaurant") as HTMLInputElement;

    selectAllCheckbox.focus();
    fireEvent.keyDown(selectAllCheckbox, { key: "ArrowDown" });
    expect(document.activeElement).toBe(doctorCheckbox);

    fireEvent.keyDown(doctorCheckbox, { key: "ArrowDown" });
    expect(document.activeElement).toBe(restaurantCheckbox);

    fireEvent.keyDown(restaurantCheckbox, { key: "ArrowUp" });
    expect(document.activeElement).toBe(doctorCheckbox);

    expect(doctorCheckbox.checked).toBe(true);
    fireEvent.keyDown(doctorCheckbox, { key: "Enter" });
    expect(doctorCheckbox.checked).toBe(false);
  });

  it("rejects invalid location (empty string)", async () => {
    await renderSearchForm();

    const locationInput = screen.getByLabelText(/location/i);
    const submitButton = screen.getByRole("button", { name: /search businesses/i });

    // Try to submit with empty location
    fireEvent.change(locationInput, { target: { value: "" } });
    fireEvent.click(submitButton);

    const fetchCalls = (global.fetch as jest.Mock).mock.calls;
    const searchCall = fetchCalls.find(([url]) => url === "/api/places/search");
    expect(searchCall).toBeUndefined();
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

    (global.fetch as jest.Mock).mockImplementation(async (url: RequestInfo | URL) => {
      if (String(url).startsWith("/api/places/business-types")) {
        return {
          ok: true,
          json: async () => ({ businessTypes: [] }),
        };
      }

      return {
        ok: true,
        json: async () => mockResponse,
      };
    });

    await renderSearchForm();

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
            searchBy: "location",
            location: "New York, NY",
            radius: 10000,
            businessTypes: undefined,
            maxBusinesses: 20,

          }),
        })
      );
    });
  });

  it("submits business-name mode using searchBy=business_name", async () => {
    const mockResponse = {
      status: "success",
      results: [],
    };

    (global.fetch as jest.Mock).mockImplementation(async (url: RequestInfo | URL) => {
      if (String(url).startsWith("/api/places/business-types")) {
        return {
          ok: true,
          json: async () => ({ businessTypes: [] }),
        };
      }

      return {
        ok: true,
        json: async () => mockResponse,
      };
    });

    await renderSearchForm();

    fireEvent.change(screen.getByLabelText(/search by/i), {
      target: { value: "business_name" },
    });
    fireEvent.change(screen.getByLabelText(/business name/i), {
      target: { value: "Acme Plumbing" },
    });
    fireEvent.change(screen.getByLabelText(/^location$/i), {
      target: { value: "Austin, TX" },
    });
    fireEvent.click(screen.getByRole("button", { name: /search businesses/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/places/search",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            searchBy: "business_name",
            businessName: "Acme Plumbing",
            location: "Austin, TX",
            radius: 5000,
            businessTypes: undefined,
            maxBusinesses: 20,
          }),
        })
      );
    });
  });

  it("displays error message when API returns error", async () => {
    const errorMessage = "Invalid location provided";
    (global.fetch as jest.Mock).mockImplementation(async (url: RequestInfo | URL) => {
      if (String(url).startsWith("/api/places/business-types")) {
        return {
          ok: true,
          json: async () => ({ businessTypes: [] }),
        };
      }

      return {
        ok: false,
        json: async () => ({ error: errorMessage }),
      };
    });

    await renderSearchForm();

    const locationInput = screen.getByLabelText(/location/i);
    const submitButton = screen.getByRole("button", { name: /search businesses/i });

    fireEvent.change(locationInput, { target: { value: "Invalid Location" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it("displays loading state during search", async () => {
    (global.fetch as jest.Mock).mockImplementation((url: RequestInfo | URL) => {
      if (String(url).startsWith("/api/places/business-types")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ businessTypes: [] }),
        });
      }

      return new Promise((resolve) =>
        setTimeout(
          () =>
            resolve({
              ok: true,
              json: async () => ({ status: "success", results: [] }),
            }),
          100
        )
      );
    });

    await renderSearchForm();

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
    (global.fetch as jest.Mock).mockImplementation(async (url: RequestInfo | URL) => {
      if (String(url).startsWith("/api/places/business-types")) {
        return {
          ok: true,
          json: async () => ({ businessTypes: [] }),
        };
      }

      throw new Error("Network error");
    });

    await renderSearchForm();

    const locationInput = screen.getByLabelText(/location/i);
    const submitButton = screen.getByRole("button", { name: /search businesses/i });

    fireEvent.change(locationInput, { target: { value: "Test Location" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  it("removes excluded business types from the search dropdown after filtered options load", async () => {
    (global.fetch as jest.Mock).mockImplementation(async (url: RequestInfo | URL) => {
      if (String(url).startsWith("/api/places/business-types")) {
        return {
          ok: true,
          json: async () => ({ businessTypes: ["doctor"] }),
        };
      }

      return {
        ok: true,
        json: async () => ({ status: "success", results: [] }),
      };
    });

    await renderSearchForm();
    await openBusinessTypeDropdown();

    await waitFor(() => {
      expect(screen.getByLabelText("Doctor")).toBeInTheDocument();
      expect(screen.queryByLabelText("Restaurant")).not.toBeInTheDocument();
    });
  });

  it("refreshes the business type checkboxes when exclusions are updated", async () => {
    let businessTypeFetchCount = 0;

    (global.fetch as jest.Mock).mockImplementation(async (url: RequestInfo | URL) => {
      if (String(url).startsWith("/api/places/business-types")) {
        businessTypeFetchCount += 1;

        return {
          ok: true,
          json: async () => ({
            businessTypes: businessTypeFetchCount === 1
              ? ["doctor", "restaurant"]
              : ["doctor"],
          }),
        };
      }

      return {
        ok: true,
        json: async () => ({ status: "success", results: [] }),
      };
    });

    await renderSearchForm();
    await openBusinessTypeDropdown();

    await waitFor(() => {
      expect(screen.getByLabelText("Restaurant")).toBeInTheDocument();
    });

    const restaurantCheckbox = screen.getByLabelText("Restaurant") as HTMLInputElement;
    expect(restaurantCheckbox.checked).toBe(true);

    window.dispatchEvent(new CustomEvent(BUSINESS_TYPE_OPTIONS_UPDATED_EVENT));

    await waitFor(() => {
      expect(screen.queryByLabelText("Restaurant")).not.toBeInTheDocument();
      expect(screen.getByLabelText("Doctor")).toBeInTheDocument();
    });
  });

  it("submits multiple selected business types", async () => {
    (global.fetch as jest.Mock).mockImplementation(async (url: RequestInfo | URL) => {
      if (String(url).startsWith("/api/places/business-types")) {
        return {
          ok: true,
          json: async () => ({ businessTypes: ["doctor", "restaurant", "plumber"] }),
        };
      }

      return {
        ok: true,
        json: async () => ({ status: "success", results: [] }),
      };
    });

    await renderSearchForm();
    await openBusinessTypeDropdown();

    fireEvent.change(screen.getByLabelText(/location/i), { target: { value: "Seattle" } });
    fireEvent.click(screen.getByLabelText(/^all$/i));
    fireEvent.click(screen.getByLabelText("Doctor"));
    fireEvent.click(screen.getByLabelText("Restaurant"));

    fireEvent.click(screen.getByRole("button", { name: /search businesses/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/places/search",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            searchBy: "location",
            businessName: undefined,
            location: "Seattle",
            radius: 5000,
            businessTypes: ["doctor", "restaurant"],
            maxBusinesses: 20,
          }),
        })
      );
    });
  });

  it("submits without business type filters when All is selected", async () => {
    (global.fetch as jest.Mock).mockImplementation(async (url: RequestInfo | URL) => {
      if (String(url).startsWith("/api/places/business-types")) {
        return {
          ok: true,
          json: async () => ({ businessTypes: ["doctor", "restaurant", "plumber"] }),
        };
      }

      return {
        ok: true,
        json: async () => ({ status: "success", results: [] }),
      };
    });

    await renderSearchForm();

    fireEvent.change(screen.getByLabelText(/location/i), { target: { value: "Seattle" } });
    fireEvent.click(screen.getByRole("button", { name: /search businesses/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/places/search",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            searchBy: "location",
            businessName: undefined,
            location: "Seattle",
            radius: 5000,
            businessTypes: undefined,
            maxBusinesses: 20,
          }),
        })
      );
    });
  });

  it("selects all business types when the select-all checkbox is checked", async () => {
    (global.fetch as jest.Mock).mockImplementation(async (url: RequestInfo | URL) => {
      if (String(url).startsWith("/api/places/business-types")) {
        return {
          ok: true,
          json: async () => ({ businessTypes: ["doctor", "restaurant"] }),
        };
      }

      return {
        ok: true,
        json: async () => ({ status: "success", results: [] }),
      };
    });

    await renderSearchForm();
    await openBusinessTypeDropdown();

    const selectAllCheckbox = screen.getByLabelText(/^all$/i) as HTMLInputElement;
    fireEvent.click(selectAllCheckbox);
    expect(selectAllCheckbox.checked).toBe(false);

    fireEvent.click(selectAllCheckbox);

    expect((screen.getByLabelText("Doctor") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Restaurant") as HTMLInputElement).checked).toBe(true);
  });

  it("shows selected business types summary when dropdown is collapsed", async () => {
    (global.fetch as jest.Mock).mockImplementation(async (url: RequestInfo | URL) => {
      if (String(url).startsWith("/api/places/business-types")) {
        return {
          ok: true,
          json: async () => ({ businessTypes: ["doctor", "restaurant"] }),
        };
      }

      return {
        ok: true,
        json: async () => ({ status: "success", results: [] }),
      };
    });

    await renderSearchForm();
    const toggleButton = screen.getByRole("button", { name: /business type/i });

    expect(toggleButton).toHaveTextContent("All");
  });

  it("shows Google Places API debug metrics after a successful search", async () => {
    const mockResponse = {
      status: "success",
      results: [],
      fromCache: false,
      metrics: {
        geocodeCalls: 1,
        nearbySearchCalls: 1,
        placeDetailsCalls: 3,
        placeDetailsFailures: 0,
        detailsCandidates: 5,
        detailsSelected: 3,
        totalGooglePlacesCalls: 5,
      },
    };

    (global.fetch as jest.Mock).mockImplementation(async (url: RequestInfo | URL) => {
      if (String(url).startsWith("/api/places/business-types")) {
        return {
          ok: true,
          json: async () => ({ businessTypes: [] }),
        };
      }

      return {
        ok: true,
        json: async () => mockResponse,
      };
    });

    await renderSearchForm();

    fireEvent.change(screen.getByLabelText(/location/i), { target: { value: "Seattle" } });
    fireEvent.click(screen.getByRole("button", { name: /search businesses/i }));

    await waitFor(() => {
      expect(screen.getByText(/Google Places API Debug/i)).toBeInTheDocument();
      expect(screen.getAllByText("5").length).toBeGreaterThan(0);
      expect(screen.getByText(/Total Calls/i)).toBeInTheDocument();
    });
  });

  it("warns and cancels repeated search when same filters previously exhausted results", async () => {
    const exhaustedResponse = {
      status: "success",
      results: [],
      reachedEndOfResults: true,
      fromCache: false,
      metrics: {
        geocodeCalls: 1,
        nearbySearchCalls: 1,
        placeDetailsCalls: 0,
        placeDetailsFailures: 0,
        detailsCandidates: 0,
        detailsSelected: 0,
        totalGooglePlacesCalls: 2,
      },
    };

    (global.fetch as jest.Mock).mockImplementation(async (url: RequestInfo | URL) => {
      if (String(url).startsWith("/api/places/business-types")) {
        return {
          ok: true,
          json: async () => ({ businessTypes: [] }),
        };
      }

      return {
        ok: true,
        json: async () => exhaustedResponse,
      };
    });

    await renderSearchForm();

    fireEvent.change(screen.getByLabelText(/location/i), { target: { value: "Seattle" } });
    fireEvent.click(screen.getByRole("button", { name: /search businesses/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/places/search",
        expect.objectContaining({ method: "POST" })
      );
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /search businesses/i })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /search businesses/i }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: /repeat search warning/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /cancel search/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /repeat search warning/i })).not.toBeInTheDocument();
    });

    const searchCalls = (global.fetch as jest.Mock).mock.calls.filter(
      ([url]) => url === "/api/places/search"
    );
    expect(searchCalls).toHaveLength(1);
  });

  it("warns and proceeds repeated search when user confirms", async () => {
    const lowResultResponse = {
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
      reachedEndOfResults: false,
      fromCache: false,
      metrics: {
        geocodeCalls: 1,
        nearbySearchCalls: 1,
        placeDetailsCalls: 1,
        placeDetailsFailures: 0,
        detailsCandidates: 1,
        detailsSelected: 1,
        totalGooglePlacesCalls: 3,
      },
    };

    (global.fetch as jest.Mock).mockImplementation(async (url: RequestInfo | URL) => {
      if (String(url).startsWith("/api/places/business-types")) {
        return {
          ok: true,
          json: async () => ({ businessTypes: [] }),
        };
      }

      return {
        ok: true,
        json: async () => lowResultResponse,
      };
    });

    await renderSearchForm();

    fireEvent.change(screen.getByLabelText(/location/i), { target: { value: "Seattle" } });
    fireEvent.click(screen.getByRole("button", { name: /search businesses/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/places/search",
        expect.objectContaining({ method: "POST" })
      );
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /search businesses/i })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /search businesses/i }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: /repeat search warning/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /proceed with search/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /repeat search warning/i })).not.toBeInTheDocument();
    });

    const searchCalls = (global.fetch as jest.Mock).mock.calls.filter(
      ([url]) => url === "/api/places/search"
    );
    expect(searchCalls).toHaveLength(2);
  });

  it("closes warning modal on escape key and cancels repeated search", async () => {
    const exhaustedResponse = {
      status: "success",
      results: [],
      reachedEndOfResults: true,
      fromCache: false,
      metrics: {
        geocodeCalls: 1,
        nearbySearchCalls: 1,
        placeDetailsCalls: 0,
        placeDetailsFailures: 0,
        detailsCandidates: 0,
        detailsSelected: 0,
        totalGooglePlacesCalls: 2,
      },
    };

    (global.fetch as jest.Mock).mockImplementation(async (url: RequestInfo | URL) => {
      if (String(url).startsWith("/api/places/business-types")) {
        return {
          ok: true,
          json: async () => ({ businessTypes: [] }),
        };
      }

      return {
        ok: true,
        json: async () => exhaustedResponse,
      };
    });

    await renderSearchForm();

    fireEvent.change(screen.getByLabelText(/location/i), { target: { value: "Seattle" } });
    fireEvent.click(screen.getByRole("button", { name: /search businesses/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /search businesses/i })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /search businesses/i }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: /repeat search warning/i })).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /repeat search warning/i })).not.toBeInTheDocument();
    });

    const searchCalls = (global.fetch as jest.Mock).mock.calls.filter(
      ([url]) => url === "/api/places/search"
    );
    expect(searchCalls).toHaveLength(1);
  });

  it("closes warning modal on outside click and cancels repeated search", async () => {
    const exhaustedResponse = {
      status: "success",
      results: [],
      reachedEndOfResults: true,
      fromCache: false,
      metrics: {
        geocodeCalls: 1,
        nearbySearchCalls: 1,
        placeDetailsCalls: 0,
        placeDetailsFailures: 0,
        detailsCandidates: 0,
        detailsSelected: 0,
        totalGooglePlacesCalls: 2,
      },
    };

    (global.fetch as jest.Mock).mockImplementation(async (url: RequestInfo | URL) => {
      if (String(url).startsWith("/api/places/business-types")) {
        return {
          ok: true,
          json: async () => ({ businessTypes: [] }),
        };
      }

      return {
        ok: true,
        json: async () => exhaustedResponse,
      };
    });

    await renderSearchForm();

    fireEvent.change(screen.getByLabelText(/location/i), { target: { value: "Seattle" } });
    fireEvent.click(screen.getByRole("button", { name: /search businesses/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /search businesses/i })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /search businesses/i }));

    const dialog = await screen.findByRole("dialog", { name: /repeat search warning/i });
    fireEvent.click(dialog);

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /repeat search warning/i })).not.toBeInTheDocument();
    });

    const searchCalls = (global.fetch as jest.Mock).mock.calls.filter(
      ([url]) => url === "/api/places/search"
    );
    expect(searchCalls).toHaveLength(1);
  });

  it("uses the previous search maxBusinesses when deciding whether to warn", async () => {
    const lowResultResponse = {
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
      reachedEndOfResults: false,
      fromCache: false,
      metrics: {
        geocodeCalls: 1,
        nearbySearchCalls: 1,
        placeDetailsCalls: 1,
        placeDetailsFailures: 0,
        detailsCandidates: 1,
        detailsSelected: 1,
        totalGooglePlacesCalls: 3,
      },
    };

    (global.fetch as jest.Mock).mockImplementation(async (url: RequestInfo | URL) => {
      if (String(url).startsWith("/api/places/business-types")) {
        return {
          ok: true,
          json: async () => ({ businessTypes: [] }),
        };
      }

      return {
        ok: true,
        json: async () => lowResultResponse,
      };
    });

    await renderSearchForm();

    fireEvent.change(screen.getByLabelText(/location/i), { target: { value: "Seattle" } });
    fireEvent.click(screen.getByRole("button", { name: /search businesses/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /search businesses/i })).toBeEnabled();
    });

    fireEvent.change(screen.getByLabelText(/max businesses per search/i), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /search businesses/i }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: /repeat search warning/i })).toBeInTheDocument();
    });

    const searchCalls = (global.fetch as jest.Mock).mock.calls.filter(
      ([url]) => url === "/api/places/search"
    );
    expect(searchCalls).toHaveLength(1);
  });
});

