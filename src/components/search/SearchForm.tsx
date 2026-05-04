"use client";

import { useEffect, useRef, useState } from "react";
import { SearchResults } from "./SearchResults";
import type { BusinessResult, SearchMetrics, SearchResponse } from "@/lib/places/types";
import {
  GOOGLE_PLACES_BUSINESS_TYPES,
  formatGooglePlaceTypeLabel,
} from "@/lib/places/business-types";
import {
  BUSINESS_TYPE_OPTIONS_UPDATED_EVENT,
  BUSINESS_TYPE_OPTIONS_UPDATED_STORAGE_KEY,
} from "@/lib/places/business-type-sync";

type InfoTooltipProps = {
  label: string;
  text: string;
};

type DebugRun = {
  timestamp: string;
  fromCache: boolean;
  metrics: SearchMetrics;
};

type NormalizedSearchFilters = {
  searchBy: SearchByOption;
  businessName: string;
  location: string;
  radius: number;
  businessTypes: string[];
  maxBusinesses: number;
};

type LastSearchSnapshot = {
  filters: NormalizedSearchFilters;
  resultCount: number;
  reachedEndOfResults: boolean;
};

type PendingSearch = {
  filters: NormalizedSearchFilters;
};

type SearchByOption = "location" | "business_name";

const SEARCH_REQUEST_TIMEOUT_MS = 45000;

function toReadableErrorMessage(errorValue: unknown, fallback: string): string {
  if (typeof errorValue === "string" && errorValue.trim().length > 0) {
    const trimmed = errorValue.trim();
    if (trimmed === "[object Object]") {
      return fallback;
    }
    return trimmed;
  }

  if (errorValue && typeof errorValue === "object") {
    if ("message" in errorValue) {
      const nestedMessage = (errorValue as { message?: unknown }).message;
      if (typeof nestedMessage === "string" && nestedMessage.trim().length > 0) {
        return nestedMessage;
      }
    }

    try {
      const serialized = JSON.stringify(errorValue);
      if (serialized && serialized !== "{}") {
        return serialized;
      }
    } catch {
      // Fall through to fallback.
    }
  }

  return fallback;
}

type SearchDebugSnapshot = {
  payload: {
    searchBy: SearchByOption;
    businessName: string | undefined;
    location: string;
    radius: number;
    businessTypes: string[] | undefined;
    maxBusinesses: number;
  };
  durationMs: number;
  outcome: "success" | "error";
};

type SearchEmailLookupResponse = {
  emailsByPlaceId?: Record<string, string>;
};

function normalizeSearchFilters(params: {
  searchBy: SearchByOption;
  businessName: string;
  location: string;
  radius: string;
  businessTypes: string[];
  maxBusinesses: string;
}): NormalizedSearchFilters {
  const parsedMaxBusinesses = Number.parseInt(params.maxBusinesses, 10);
  const safeMaxBusinesses = Number.isFinite(parsedMaxBusinesses)
    ? Math.min(20, Math.max(1, parsedMaxBusinesses))
    : 20;

  return {
    searchBy: params.searchBy,
    businessName: params.businessName.trim(),
    location: params.location.trim(),
    radius: parseInt(params.radius, 10),
    businessTypes: params.businessTypes,
    maxBusinesses: safeMaxBusinesses,
  };
}

function hasSameSearchCriteria(a: NormalizedSearchFilters, b: NormalizedSearchFilters): boolean {
  return (
    a.searchBy === b.searchBy &&
    a.businessName === b.businessName &&
    a.location === b.location &&
    a.radius === b.radius &&
    [...a.businessTypes].sort().join(',') === [...b.businessTypes].sort().join(',')
  );
}

function InfoTooltip({ label, text }: InfoTooltipProps) {
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        aria-label={label}
        className="theme-border theme-text-muted group inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-[#be779e]"
      >
        i
        <span className="theme-surface theme-border pointer-events-none absolute left-full top-1/2 z-20 ml-2 hidden w-64 -translate-y-1/2 rounded-md border px-2 py-1.5 text-left text-xs font-normal text-[var(--surface-foreground)] shadow-lg group-hover:block group-focus:block">
          {text}
        </span>
      </button>
    </span>
  );
}

export default function SearchForm() {
  const [searchBy, setSearchBy] = useState<SearchByOption>("location");
  const [businessName, setBusinessName] = useState("");
  const [location, setLocation] = useState("");
  const [radius, setRadius] = useState("5000");
  const [businessTypes, setBusinessTypes] = useState<string[]>([]);
  const [allBusinessTypesChecked, setAllBusinessTypesChecked] = useState(true);
  const [businessTypeOptions, setBusinessTypeOptions] = useState<string[]>(GOOGLE_PLACES_BUSINESS_TYPES);
  const [maxBusinesses, setMaxBusinesses] = useState("20");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<BusinessResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [latestMetrics, setLatestMetrics] = useState<SearchMetrics | null>(null);
  const [debugHistory, setDebugHistory] = useState<DebugRun[]>([]);
  const [lastSearchDebugSnapshot, setLastSearchDebugSnapshot] = useState<SearchDebugSnapshot | null>(null);
  const [lastSearchSnapshot, setLastSearchSnapshot] = useState<LastSearchSnapshot | null>(null);
  const [showRepeatWarning, setShowRepeatWarning] = useState(false);
  const [pendingSearch, setPendingSearch] = useState<PendingSearch | null>(null);
  const [isBusinessTypeDropdownOpen, setIsBusinessTypeDropdownOpen] = useState(false);
  const hasInitializedBusinessTypesFromOptions = useRef(false);
  const businessTypeDropdownRef = useRef<HTMLDivElement | null>(null);
  const businessTypeToggleButtonRef = useRef<HTMLButtonElement | null>(null);

  const hydrateResultEmails = async (resultItems: BusinessResult[]) => {
    const placeIds = resultItems
      .filter((item) => !item.email && item.placeId)
      .map((item) => item.placeId);

    if (placeIds.length === 0) {
      return;
    }

    try {
      const response = await fetch('/api/places/search/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ placeIds }),
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as SearchEmailLookupResponse;
      const emailsByPlaceId = payload.emailsByPlaceId || {};

      setResults((currentResults) =>
        currentResults.map((result) => {
          const resolvedEmail = emailsByPlaceId[result.placeId];
          if (!resolvedEmail || result.email) {
            return result;
          }

          return {
            ...result,
            email: resolvedEmail,
          };
        })
      );
    } catch {
      // Ignore hydration errors to keep search UX smooth.
    }
  };

  const primaryInputLabel = searchBy === "location" ? "Location" : "Business Name";
  const primaryInputPlaceholder =
    searchBy === "location" ? "City, ZIP code, or address" : "Business name";
  const primaryInputValue = searchBy === "location" ? location : businessName;
  const selectedBusinessTypes = businessTypeOptions
    .filter((type) => businessTypes.includes(type));
  const allBusinessTypesSelected = allBusinessTypesChecked;
  const selectedBusinessTypeLabels = selectedBusinessTypes
    .map((type) => formatGooglePlaceTypeLabel(type));
  const businessTypeSummary = allBusinessTypesSelected
    ? "All"
    : selectedBusinessTypeLabels.length > 0
      ? selectedBusinessTypeLabels.join(", ")
      : "None selected";
  const businessTypeSummaryDisplay =
    businessTypeSummary.length > 72
      ? `${businessTypeSummary.slice(0, 69)}...`
      : businessTypeSummary;

  useEffect(() => {
    let isMounted = true;

    const loadBusinessTypes = async () => {
      try {
        const response = await fetch('/api/places/business-types?forSearch=true', {
          cache: 'no-store',
        });
        if (!response.ok) {
          return;
        }

        const data: { businessTypes?: string[] } = await response.json();
        if (isMounted && Array.isArray(data.businessTypes)) {
          const loadedBusinessTypes = data.businessTypes;
          setBusinessTypeOptions(loadedBusinessTypes);
          setBusinessTypes((currentValues) => {
            if (!hasInitializedBusinessTypesFromOptions.current) {
              hasInitializedBusinessTypesFromOptions.current = true;
              return [...loadedBusinessTypes];
            }

            return currentValues.filter((type) => loadedBusinessTypes.includes(type));
          });
        }
      } catch {
        // Keep static defaults when dynamic loading fails.
      }
    };

    const handleBusinessTypeOptionsUpdated = () => {
      void loadBusinessTypes();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === BUSINESS_TYPE_OPTIONS_UPDATED_STORAGE_KEY) {
        void loadBusinessTypes();
      }
    };

    loadBusinessTypes();

    window.addEventListener(BUSINESS_TYPE_OPTIONS_UPDATED_EVENT, handleBusinessTypeOptionsUpdated);
    window.addEventListener('storage', handleStorage);

    return () => {
      isMounted = false;
      window.removeEventListener(BUSINESS_TYPE_OPTIONS_UPDATED_EVENT, handleBusinessTypeOptionsUpdated);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    if (allBusinessTypesChecked) {
      setBusinessTypes([...businessTypeOptions]);
      return;
    }

    setBusinessTypes((currentValues) =>
      currentValues.filter((type) => businessTypeOptions.includes(type))
    );
  }, [allBusinessTypesChecked, businessTypeOptions]);

  const executeSearch = async (normalizedFilters: NormalizedSearchFilters) => {
    setError(null);
    setIsSearching(true);
    setHasSearched(true);

    const searchPayload = {
      searchBy: normalizedFilters.searchBy,
      businessName: normalizedFilters.searchBy === "business_name"
        ? normalizedFilters.businessName
        : undefined,
      location: normalizedFilters.location,
      radius: normalizedFilters.radius,
      businessTypes: normalizedFilters.businessTypes.length > 0
        ? normalizedFilters.businessTypes
        : undefined,
      maxBusinesses: normalizedFilters.maxBusinesses,
    };
    const requestStartMs =
      typeof performance !== "undefined" ? performance.now() : Date.now();

    try {
      const searchAbortController = new AbortController();
      const searchTimeoutId = window.setTimeout(() => {
        searchAbortController.abort();
      }, SEARCH_REQUEST_TIMEOUT_MS);

      const response = await (async () => {
        try {
          return await fetch("/api/places/search", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            signal: searchAbortController.signal,
            body: JSON.stringify(searchPayload),
          });
        } finally {
          window.clearTimeout(searchTimeoutId);
        }
      })();

      let data: SearchResponse | null = null;
      try {
        data = (await response.json()) as SearchResponse;
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(toReadableErrorMessage(data?.error, "Failed to search businesses"));
      }

      if (!data) {
        throw new Error("Failed to read search response from server");
      }

      if (data.status === "error") {
        throw new Error(toReadableErrorMessage(data.error, "Search failed"));
      }

      const responseResults = data.results || [];
      setResults(responseResults);
      void hydrateResultEmails(responseResults);
      setLastSearchSnapshot({
        filters: normalizedFilters,
        resultCount: responseResults.length,
        reachedEndOfResults:
          data.reachedEndOfResults === true ||
          responseResults.length < normalizedFilters.maxBusinesses,
      });

      // Fire-and-forget: kick off background validation/scraping for newly
      // discovered leads so website status and emails are populated without
      // blocking the search UI.
      fetch("/api/jobs/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxJobs: 100 }),
      })
        .then(() => hydrateResultEmails(responseResults))
        .catch(() => {});

      const metrics = data.metrics || {
        geocodeCalls: 0,
        nearbySearchCalls: 0,
        placeDetailsCalls: 0,
        placeDetailsFailures: 0,
        detailsCandidates: 0,
        detailsSelected: 0,
        totalGooglePlacesCalls: 0,
      };

      if (process.env.NODE_ENV !== 'production') {
        setLastSearchDebugSnapshot({
          payload: searchPayload,
          durationMs: Math.round(performance.now() - requestStartMs),
          outcome: "success",
        });

        setLatestMetrics(metrics);
        setDebugHistory((prev) => [
          {
            timestamp: new Date().toLocaleTimeString(),
            fromCache: !!data.fromCache,
            metrics,
          },
          ...prev,
        ].slice(0, 10));
      }
    } catch (err) {
      const requestEndMs =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      const durationMs = Math.max(0, Math.round(requestEndMs - requestStartMs));

      if (err instanceof DOMException && err.name === "AbortError") {
        if (process.env.NODE_ENV !== 'production') {
          setLastSearchDebugSnapshot({
            payload: searchPayload,
            durationMs,
            outcome: "error",
          });
        }

        setError("Search timed out. Please narrow the filters and try again.");
        setResults([]);
        return;
      }

      if (process.env.NODE_ENV !== 'production') {
        setLastSearchDebugSnapshot({
          payload: searchPayload,
          durationMs,
          outcome: "error",
        });
      }

      setError(toReadableErrorMessage(err, "An error occurred"));
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const businessTypesForSearch = allBusinessTypesChecked
      ? []
      : businessTypes;

    const normalizedFilters = normalizeSearchFilters({
      searchBy,
      businessName,
      location,
      radius,
      businessTypes: businessTypesForSearch,
      maxBusinesses,
    });

    const shouldWarnForRepeatedSearch =
      !!lastSearchSnapshot &&
      hasSameSearchCriteria(lastSearchSnapshot.filters, normalizedFilters) &&
      (lastSearchSnapshot.reachedEndOfResults ||
        lastSearchSnapshot.resultCount < lastSearchSnapshot.filters.maxBusinesses);

    if (shouldWarnForRepeatedSearch) {
      setPendingSearch({ filters: normalizedFilters });
      setShowRepeatWarning(true);
      return;
    }

    await executeSearch(normalizedFilters);
  };

  const handleProceedRepeatedSearch = async () => {
    if (!pendingSearch) {
      setShowRepeatWarning(false);
      return;
    }

    setShowRepeatWarning(false);
    const searchToRun = pendingSearch;
    setPendingSearch(null);
    await executeSearch(searchToRun.filters);
  };

  const handleCancelRepeatedSearch = () => {
    setShowRepeatWarning(false);
    setPendingSearch(null);
  };

  const handleSelectEnterKeyDown = (event: React.KeyboardEvent<HTMLSelectElement>) => {
    if (event.key !== "Enter") {
      return;
    }

    // Prevent accidental form submit and open the native select picker instead.
    event.preventDefault();
    const selectElement = event.currentTarget as HTMLSelectElement & {
      showPicker?: () => void;
    };

    if (typeof selectElement.showPicker === "function") {
      selectElement.showPicker();
      return;
    }

    selectElement.click();
  };

  const handleBusinessTypeCheckboxEnterKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();

      const inputs = Array.from(
        businessTypeDropdownRef.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]') || []
      );
      const currentIndex = inputs.indexOf(event.currentTarget);
      if (currentIndex === -1 || inputs.length === 0) {
        return;
      }

      const nextIndex = event.key === "ArrowDown"
        ? (currentIndex + 1) % inputs.length
        : (currentIndex - 1 + inputs.length) % inputs.length;
      inputs[nextIndex]?.focus();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsBusinessTypeDropdownOpen(false);
      businessTypeToggleButtonRef.current?.focus();
      return;
    }

    if (event.key !== "Enter") {
      return;
    }

    // Keep Enter scoped to toggling the focused option instead of submitting the form.
    event.preventDefault();
    event.currentTarget.click();
  };

  useEffect(() => {
    if (!showRepeatWarning) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleCancelRepeatedSearch();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showRepeatWarning]);

  useEffect(() => {
    if (!isBusinessTypeDropdownOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!businessTypeDropdownRef.current) {
        return;
      }

      if (!businessTypeDropdownRef.current.contains(event.target as Node)) {
        setIsBusinessTypeDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsBusinessTypeDropdownOpen(false);
        businessTypeToggleButtonRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isBusinessTypeDropdownOpen]);

  return (
    <div className="space-y-8">
      <div className="theme-surface theme-border rounded-xl border p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="searchBy"
              className="theme-text-muted block text-sm font-medium"
            >
              Search By
            </label>
            <select
              id="searchBy"
              value={searchBy}
              onChange={(e) => setSearchBy(e.target.value as SearchByOption)}
              onKeyDown={handleSelectEnterKeyDown}
              className="theme-input mt-1 block w-full rounded-lg border px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="location">Location</option>
              <option value="business_name">Business Name</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="primarySearchInput"
              className="theme-text-muted block text-sm font-medium"
            >
              {primaryInputLabel}
            </label>
            <input
              type="text"
              id="primarySearchInput"
              value={primaryInputValue}
              onChange={(e) => {
                if (searchBy === "location") {
                  setLocation(e.target.value);
                  return;
                }
                setBusinessName(e.target.value);
              }}
              placeholder={primaryInputPlaceholder}
              required
              className="theme-input mt-1 block w-full rounded-lg border px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {searchBy === "business_name" && (
            <div>
              <label
                htmlFor="location"
                className="theme-text-muted block text-sm font-medium"
              >
                Location
              </label>
              <input
                type="text"
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, ZIP code, or address"
                required
                className="theme-input mt-1 block w-full rounded-lg border px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="radius"
              className="theme-text-muted block text-sm font-medium"
            >
              Search Radius
            </label>
            <select
              id="radius"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              onKeyDown={handleSelectEnterKeyDown}
              required
              className="theme-input mt-1 block w-full rounded-lg border px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="1000">1 km</option>
              <option value="5000">5 km</option>
              <option value="10000">10 km</option>
              <option value="25000">25 km</option>
              <option value="50000">50 km</option>
            </select>
          </div>

          <div>
            <fieldset>
              <legend className="theme-text-muted block text-sm font-medium">
                Business Type
              </legend>
              <div className="relative mt-1" ref={businessTypeDropdownRef}>
                <button
                  type="button"
                  aria-label="Business Type"
                  aria-expanded={isBusinessTypeDropdownOpen}
                  ref={businessTypeToggleButtonRef}
                  onClick={() => setIsBusinessTypeDropdownOpen((open) => !open)}
                  className="theme-input flex w-full max-w-full items-center justify-between overflow-hidden rounded-lg border px-3 py-2 text-left focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <span className="min-w-0 flex-1 truncate" title={businessTypeSummary}>
                    {businessTypeSummaryDisplay}
                  </span>
                  <span className="theme-text-muted ml-2 shrink-0 text-xs">
                    {isBusinessTypeDropdownOpen ? "▲" : "▼"}
                  </span>
                </button>

                {isBusinessTypeDropdownOpen && (
                  <div className="theme-input absolute left-0 right-0 z-20 mt-1 max-w-full space-y-1 overflow-x-hidden rounded-lg border px-3 py-2 shadow-lg">
                    <label className="flex items-center gap-2 font-medium">
                      <input
                        type="checkbox"
                        checked={allBusinessTypesSelected}
                        onKeyDown={handleBusinessTypeCheckboxEnterKeyDown}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAllBusinessTypesChecked(true);
                            return;
                          }
                          setAllBusinessTypesChecked(false);
                          setBusinessTypes([]);
                        }}
                      />
                      <span>All</span>
                    </label>
                    <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                      {businessTypeOptions.map((type) => {
                        const checked = businessTypes.includes(type);
                        return (
                          <label key={type} className="flex min-w-0 items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onKeyDown={handleBusinessTypeCheckboxEnterKeyDown}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setBusinessTypes((currentTypes) => {
                                    const nextTypes = Array.from(new Set([...currentTypes, type]));
                                    setAllBusinessTypesChecked(nextTypes.length === businessTypeOptions.length);
                                    return nextTypes;
                                  });
                                  return;
                                }

                                setAllBusinessTypesChecked(false);
                                setBusinessTypes((currentTypes) =>
                                  currentTypes.filter((currentType) => currentType !== type)
                                );
                              }}
                            />
                            <span className="min-w-0 break-words">{formatGooglePlaceTypeLabel(type)}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </fieldset>
          </div>

          <div>
            <div className="theme-text-muted flex items-center gap-2 text-sm font-medium">
              <label htmlFor="maxBusinesses">Max Businesses Per Search</label>
              <InfoTooltip
                label="Max businesses info"
                text="Limits how many businesses are processed from the nearby search response for this run."
              />
            </div>
            <input
              id="maxBusinesses"
              type="number"
              min={1}
              max={20}
              value={maxBusinesses}
              onChange={(e) => setMaxBusinesses(e.target.value)}
              className="theme-input mt-1 block w-full rounded-lg border px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSearching}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSearching ? "Searching..." : "Search Businesses"}
          </button>
        </form>

        {error && (
          <div className="theme-badge-critical mt-4 rounded-lg border border-white/10 p-4 text-sm">
            {error}
          </div>
        )}

        {process.env.NODE_ENV !== 'production' && <div className="theme-surface-muted theme-border mt-4 rounded-lg border p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Google Places API Debug</h3>
            <span className="theme-text-muted text-xs">Last 10 searches</span>
          </div>

          {!latestMetrics ? (
            <p className="theme-text-muted mt-2 text-xs">
              Run a search to see exact Google Places API call counts.
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
              <div className="theme-surface theme-border rounded border p-2">
                <div className="theme-text-muted">Total Calls</div>
                <div className="font-semibold">{latestMetrics.totalGooglePlacesCalls}</div>
              </div>
              <div className="theme-surface theme-border rounded border p-2">
                <div className="theme-text-muted">Geocode</div>
                <div className="font-semibold">{latestMetrics.geocodeCalls}</div>
              </div>
              <div className="theme-surface theme-border rounded border p-2">
                <div className="theme-text-muted">Nearby Search</div>
                <div className="font-semibold">{latestMetrics.nearbySearchCalls}</div>
              </div>
              <div className="theme-surface theme-border rounded border p-2">
                <div className="theme-text-muted">Place Details</div>
                <div className="font-semibold">{latestMetrics.placeDetailsCalls}</div>
              </div>
            </div>
          )}

          {lastSearchDebugSnapshot && (
            <div className="theme-surface theme-border mt-4 rounded border p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h4 className="text-xs font-semibold">Last Search Request</h4>
                <span className="theme-text-muted text-xs">
                  {lastSearchDebugSnapshot.outcome} in {lastSearchDebugSnapshot.durationMs}ms
                </span>
              </div>
              <pre className="theme-text-muted overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed">
                {JSON.stringify(lastSearchDebugSnapshot.payload, null, 2)}
              </pre>
            </div>
          )}

          {debugHistory.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="theme-text-muted theme-border border-b text-left">
                    <th className="px-2 py-1">Time</th>
                    <th className="px-2 py-1">Cache</th>
                    <th className="px-2 py-1">Total</th>
                    <th className="px-2 py-1">Geo</th>
                    <th className="px-2 py-1">Near</th>
                    <th className="px-2 py-1">Det</th>
                    <th className="px-2 py-1">Det Fail</th>
                    <th className="px-2 py-1">Cand</th>
                  </tr>
                </thead>
                <tbody>
                  {debugHistory.map((run, idx) => (
                    <tr key={`${run.timestamp}-${idx}`} className="theme-border border-b">
                      <td className="px-2 py-1">{run.timestamp}</td>
                      <td className="px-2 py-1">{run.fromCache ? "yes" : "no"}</td>
                      <td className="px-2 py-1 font-medium">{run.metrics.totalGooglePlacesCalls}</td>
                      <td className="px-2 py-1">{run.metrics.geocodeCalls}</td>
                      <td className="px-2 py-1">{run.metrics.nearbySearchCalls}</td>
                      <td className="px-2 py-1">{run.metrics.placeDetailsCalls}</td>
                      <td className="px-2 py-1">{run.metrics.placeDetailsFailures}</td>
                      <td className="px-2 py-1">{run.metrics.detailsCandidates}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>}
      </div>

      {hasSearched && (
        <SearchResults results={results} isLoading={isSearching} />
      )}

      {showRepeatWarning && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="repeat-search-warning-title"
          aria-describedby="repeat-search-warning-description"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              handleCancelRepeatedSearch();
            }
          }}
        >
          <div className="theme-surface theme-border w-full max-w-lg rounded-xl border p-6 shadow-xl">
            <h2 id="repeat-search-warning-title" className="text-lg font-semibold">
              Repeat Search Warning
            </h2>
            <p
              id="repeat-search-warning-description"
              className="theme-text-muted mt-2 text-sm leading-relaxed"
            >
              Your last search with these exact filters likely exhausted available Google
              Places results for this query. Running it again may consume additional API
              calls with little or no new leads.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleCancelRepeatedSearch}
                className="theme-input rounded-lg border px-4 py-2 text-sm font-medium"
              >
                Cancel Search
              </button>
              <button
                type="button"
                onClick={handleProceedRepeatedSearch}
                className="rounded-lg bg-[#be779e] px-4 py-2 text-sm font-medium text-[#0a0a0a] hover:bg-[#cf8ab1] focus:outline-none focus:ring-2 focus:ring-[#be779e] focus:ring-offset-2 focus:ring-offset-[#0a0a0a]"
              >
                Proceed With Search
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
