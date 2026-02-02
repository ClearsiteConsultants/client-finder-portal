"use client";

import { useState } from "react";
import { SearchResults } from "./SearchResults";
import type { BusinessResult } from "@/lib/places/types";

const BUSINESS_TYPES = [
  { value: "", label: "All Business Types" },
  { value: "restaurant", label: "Restaurant" },
  { value: "cafe", label: "Cafe" },
  { value: "bar", label: "Bar" },
  { value: "retail", label: "Retail Store" },
  { value: "gym", label: "Gym / Fitness" },
  { value: "salon", label: "Salon / Spa" },
  { value: "auto_repair", label: "Auto Repair" },
  { value: "dentist", label: "Dentist" },
  { value: "lawyer", label: "Lawyer" },
  { value: "real_estate_agency", label: "Real Estate" },
];

export default function SearchForm() {
  const [location, setLocation] = useState("");
  const [radius, setRadius] = useState("5000");
  const [businessType, setBusinessType] = useState("");
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
      const response = await fetch("/api/places/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          location,
          radius: parseInt(radius, 10),
          businessType: businessType || undefined,
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
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="location"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
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
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
            />
          </div>

          <div>
            <label
              htmlFor="radius"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Search Radius
            </label>
            <select
              id="radius"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Business Type
            </label>
            <select
              id="businessType"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              {BUSINESS_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
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
