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
      <div className="theme-surface theme-border rounded-xl border p-8 shadow-sm">
        <div className="flex items-center justify-center">
          <div className="theme-text-muted">Loading results...</div>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="theme-surface theme-border rounded-xl border p-8 shadow-sm">
        <div className="text-center">
          <p className="theme-text-muted">
            No businesses found. Try adjusting your search criteria.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Search Results ({results.length})
        </h2>
      </div>

      <div className="space-y-3">
        {results.map((business) => (
          <div
            key={business.placeId}
            className="theme-surface theme-border rounded-xl border p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-base font-semibold">
                  {business.name}
                </h3>
                <p className="theme-text-muted mt-1 text-sm">
                  {business.address}
                </p>

                <div className="mt-3 flex flex-wrap gap-4 text-sm">
                  {business.email && (
                    <div className="theme-text-muted flex items-center gap-1.5">
                      <span className="font-medium">Email:</span>
                      <a
                        href={`mailto:${business.email}`}
                        className="text-[#be779e] hover:underline"
                      >
                        {business.email}
                      </a>
                    </div>
                  )}

                  {business.phone && (
                    <div className="theme-text-muted flex items-center gap-1.5">
                      <span className="font-medium">Phone:</span>
                      <span>{business.phone}</span>
                    </div>
                  )}

                  <div className="theme-text-muted flex items-center gap-1.5">
                    <span className="font-medium">Website:</span>
                    {business.hasWebsite ? (
                      business.website ? (
                        <a
                          href={business.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#be779e] hover:underline"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-[#9fd2a5]">
                          Yes
                        </span>
                      )
                    ) : (
                      <span className="theme-text-muted">None</span>
                    )}
                  </div>

                  <div className="theme-text-muted flex items-center gap-1.5">
                    <span className="font-medium">Maps:</span>
                    <a
                      href={googleMapsPlaceUrl(business.placeId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#be779e] hover:underline"
                    >
                      View
                    </a>
                  </div>

                  {business.rating !== undefined && business.rating !== null && (
                    <div className="theme-text-muted flex items-center gap-1.5">
                      <span className="font-medium">Rating:</span>
                      <span>
                        {business.rating.toFixed(1)} ⭐
                      </span>
                    </div>
                  )}

                  {business.reviewCount !== undefined && business.reviewCount !== null && (
                    <div className="theme-text-muted flex items-center gap-1.5">
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
                        className="theme-badge-info inline-flex rounded-full border border-white/10 px-2.5 py-0.5 text-xs font-medium"
                      >
                        {type.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="ml-4 flex flex-col items-end gap-2">
                {business.isNew && (
                  <span className="theme-badge-accent inline-flex rounded-full border border-white/10 px-2.5 py-0.5 text-xs font-medium">
                    New Lead
                  </span>
                )}
                {business.isCached && (
                  <span className="theme-badge-warning inline-flex rounded-full border border-white/10 px-2.5 py-0.5 text-xs font-medium">
                    Cached
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="theme-badge-info rounded-lg border border-white/10 p-4">
        <p className="text-sm">
          <strong>Note:</strong> Results have been automatically
          added to your lead list with a status of "pending" for review.
        </p>
      </div>
    </div>
  );
}
