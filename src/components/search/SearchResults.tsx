"use client";

import type { BusinessResult } from "@/lib/places/types";
import { googleMapsPlaceUrl } from "@/lib/places/maps";

interface SearchResultsProps {
  results: BusinessResult[];
  isLoading: boolean;
}

export function SearchResults({ results, isLoading }: SearchResultsProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center justify-center">
          <div className="text-slate-600 dark:text-slate-400">Loading results...</div>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400">
            No businesses found. Try adjusting your search criteria.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
          Search Results ({results.length})
        </h2>
      </div>

      <div className="space-y-3">
        {results.map((business) => (
          <div
            key={business.placeId}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-950"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                  {business.name}
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {business.address}
                </p>

                <div className="mt-3 flex flex-wrap gap-4 text-sm">
                  {business.phone && (
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                      <span className="font-medium">Phone:</span>
                      <span>{business.phone}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <span className="font-medium">Website:</span>
                    {business.hasWebsite ? (
                      business.website ? (
                        <a
                          href={business.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline dark:text-blue-400"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          Yes
                        </span>
                      )
                    ) : (
                      <span className="text-slate-500">None</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <span className="font-medium">Maps:</span>
                    <a
                      href={googleMapsPlaceUrl(business.placeId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      View
                    </a>
                  </div>

                  {business.rating !== undefined && business.rating !== null && (
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                      <span className="font-medium">Rating:</span>
                      <span>
                        {business.rating.toFixed(1)} ⭐
                      </span>
                    </div>
                  )}

                  {business.reviewCount !== undefined && business.reviewCount !== null && (
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                      <span className="font-medium">Reviews:</span>
                      <span>{business.reviewCount}</span>
                    </div>
                  )}
                </div>

                {business.businessTypes && business.businessTypes.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {business.businessTypes.slice(0, 3).map((type) => (
                      <span
                        key={type}
                        className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {type.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="ml-4 flex flex-col items-end gap-2">
                {business.isNew && (
                  <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    New Lead
                  </span>
                )}
                {business.isCached && (
                  <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    Cached
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          <strong>Note:</strong> Results marked as "New Lead" have been automatically
          added to your lead list with a status of "pending" for review.
        </p>
      </div>
    </div>
  );
}
