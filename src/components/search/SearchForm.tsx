"use client";

import { useState } from "react";
import { SearchResults } from "./SearchResults";
import type { BusinessResult, SearchMetrics, SearchResponse } from "@/lib/places/types";
import {
  GOOGLE_PLACES_BUSINESS_TYPES,
  formatGooglePlaceTypeLabel,
} from "@/lib/places/business-types";

type InfoTooltipProps = {
  label: string;
  text: string;
};

type DebugRun = {
  timestamp: string;
  fromCache: boolean;
  metrics: SearchMetrics;
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
  const [maxBusinesses, setMaxBusinesses] = useState("20");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<BusinessResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [latestMetrics, setLatestMetrics] = useState<SearchMetrics | null>(null);
  const [debugHistory, setDebugHistory] = useState<DebugRun[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSearching(true);
    setHasSearched(true);

    try {
      const parsedMaxBusinesses = Number.parseInt(maxBusinesses, 10);
      const safeMaxBusinesses = Number.isFinite(parsedMaxBusinesses)
        ? Math.min(20, Math.max(1, parsedMaxBusinesses))
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
          maxBusinesses: safeMaxBusinesses,
        }),
      });

      const data: SearchResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to search businesses");
      }

      if (data.status === "error") {
        throw new Error(data.error || "Search failed");
      }

      setResults(data.results || []);

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
                  {formatGooglePlaceTypeLabel(type)}
                </option>
              ))}
            </select>
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

        {process.env.NODE_ENV !== 'production' && <div className="mt-4 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
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
              <div className="rounded border border-slate-200 p-2 dark:border-slate-700">
                <div className="theme-text-muted">Total Calls</div>
                <div className="font-semibold">{latestMetrics.totalGooglePlacesCalls}</div>
              </div>
              <div className="rounded border border-slate-200 p-2 dark:border-slate-700">
                <div className="theme-text-muted">Geocode</div>
                <div className="font-semibold">{latestMetrics.geocodeCalls}</div>
              </div>
              <div className="rounded border border-slate-200 p-2 dark:border-slate-700">
                <div className="theme-text-muted">Nearby Search</div>
                <div className="font-semibold">{latestMetrics.nearbySearchCalls}</div>
              </div>
              <div className="rounded border border-slate-200 p-2 dark:border-slate-700">
                <div className="theme-text-muted">Place Details</div>
                <div className="font-semibold">{latestMetrics.placeDetailsCalls}</div>
              </div>
            </div>
          )}

          {debugHistory.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="theme-text-muted border-b border-slate-200 text-left dark:border-slate-700">
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
                    <tr key={`${run.timestamp}-${idx}`} className="border-b border-slate-100 dark:border-slate-800">
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
    </div>
  );
}
