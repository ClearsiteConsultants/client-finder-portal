"use client";

import { useState } from "react";
import { SearchResults } from "./SearchResults";
import type { BusinessResult } from "@/lib/places/types";
import {
  GOOGLE_PLACES_BUSINESS_TYPES,
} from "@/lib/places/business-types";

type InfoTooltipProps = {
  label: string;
  text: string;
};

function InfoTooltip({ label, text }: InfoTooltipProps) {
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        aria-label={label}
        className="group inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-400 text-[10px] font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-500 dark:text-slate-300"
      >
        i
        <span className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 hidden w-64 -translate-y-1/2 rounded-md bg-slate-900 px-2 py-1.5 text-left text-xs font-normal text-white shadow-lg group-hover:block group-focus:block dark:bg-slate-800">
          {text}
        </span>
      </button>
    </span>
  );
}

export default function SearchForm() {
  const [location, setLocation] = useState("");
  const [radius, setRadius] = useState("5000");
  const [businessType, setBusinessType] = useState("");
  const [enrichDetails, setEnrichDetails] = useState(true);
  const [enrichOnlyWhenMissing, setEnrichOnlyWhenMissing] = useState(true);
  const [detailsLimit, setDetailsLimit] = useState("20");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<BusinessResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSearching(true);
    setHasSearched(true);

    try {
      const parsedDetailsLimit = Number.parseInt(detailsLimit, 10);
      const safeDetailsLimit = Number.isFinite(parsedDetailsLimit)
        ? Math.min(60, Math.max(0, parsedDetailsLimit))
        : 20;

      const response = await fetch("/api/places/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          location,
          radius: parseInt(radius, 10),
          businessType: businessType || undefined,
          detailsEnrichment: {
            enabled: enrichDetails,
            onlyWhenMissing: enrichOnlyWhenMissing,
            maxPlaces: safeDetailsLimit,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to search businesses");
      }

      if (data.status === "error") {
        throw new Error(data.error || "Search failed");
      }

      setResults(data.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="theme-surface theme-border rounded-xl border p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <label
              htmlFor="businessType"
              className="theme-text-muted block text-sm font-medium"
            >
              Business Type
            </label>
            <select
              id="businessType"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="theme-input mt-1 block w-full rounded-lg border px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Business Types</option>
              {GOOGLE_PLACES_BUSINESS_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <p className="theme-text-muted flex items-center gap-2 text-sm font-medium">
              <span>Details Enrichment</span>
              <InfoTooltip
                label="Details enrichment info"
                text="Fetches Google Place Details for more complete lead data, but may increase search time and API usage."
              />
            </p>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enrichDetails}
                onChange={(e) => setEnrichDetails(e.target.checked)}
              />
              <span className="flex items-center gap-2">
                <span>Fetch Place Details (website/full address)</span>
                <InfoTooltip
                  label="Fetch place details info"
                  text="When enabled, this queries the Place Details endpoint so website, phone, and full address can be saved."
                />
              </span>
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enrichOnlyWhenMissing}
                onChange={(e) => setEnrichOnlyWhenMissing(e.target.checked)}
                disabled={!enrichDetails}
              />
              <span className="flex items-center gap-2">
                <span>Only enrich results with missing fields</span>
                <InfoTooltip
                  label="Only missing fields info"
                  text="Reduces API calls by enriching only businesses missing website, address, or phone in nearby search results."
                />
              </span>
            </label>

            <div>
              <div className="theme-text-muted flex items-center gap-2 text-sm font-medium">
                <label htmlFor="detailsLimit">Max Details Fetches Per Search</label>
                <InfoTooltip
                  label="Max details fetches info"
                  text="Lower values are faster and use less quota. Setting this to 0 disables details fetching for the current search."
                />
              </div>
              <input
                id="detailsLimit"
                type="number"
                min={0}
                max={60}
                value={detailsLimit}
                onChange={(e) => setDetailsLimit(e.target.value)}
                disabled={!enrichDetails}
                className="theme-input mt-1 block w-full rounded-lg border px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSearching}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-slate-950"
          >
            {isSearching ? "Searching..." : "Search Businesses"}
          </button>
        </form>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}
      </div>

      {hasSearched && (
        <SearchResults results={results} isLoading={isSearching} />
      )}
    </div>
  );
}
