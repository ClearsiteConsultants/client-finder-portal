/**
 * Business logic for Places API integration
 */

import { PlacesClient } from './client';
import { normalizeGooglePlace, toPrismaCreateInput } from './normalizer';
import type { SearchRequest, SearchResponse, BusinessResult, GooglePlaceResult, SearchMetrics } from './types';
import { prisma } from '../prisma';
import type { Business } from '@prisma/client';
import {
  generateCacheKey,
} from './cache';
import { RateLimiter, retryWithBackoff } from './rate-limiter';
import { calculateScore, checkBusinessExclusionBatchWithTypes } from '../scoring';
import { getExcludedBusinessTypes } from '../scoring/exclusions';
import { JobQueueService } from '../jobs/queue-service';

export class PlacesService {
  private client: PlacesClient;
  private rateLimiter: RateLimiter;
  private jobQueue: JobQueueService;

  constructor(apiKey?: string) {
    this.client = new PlacesClient(apiKey);
    // Conservative rate limiting: 100ms between calls, max 50 per minute
    this.rateLimiter = new RateLimiter(100, 50);
    this.jobQueue = new JobQueueService();
  }

  /**
   * Search for businesses and persist to database
   */
  async search(
    request: SearchRequest,
    userId: string,
    options: { forceRefresh?: boolean } = {}
  ): Promise<SearchResponse> {
    const metrics: SearchMetrics = {
      geocodeCalls: 0,
      nearbySearchCalls: 0,
      placeDetailsCalls: 0,
      placeDetailsFailures: 0,
      detailsCandidates: 0,
      detailsSelected: 0,
      totalGooglePlacesCalls: 0,
    };

    const finalizeMetrics = (): SearchMetrics => ({
      ...metrics,
      totalGooglePlacesCalls:
        metrics.geocodeCalls + metrics.nearbySearchCalls + metrics.placeDetailsCalls,
    });

    try {
      // Parse location - check if it's lat,lng or needs geocoding
      let location: { lat: number; lng: number };
      
      const latLngMatch = request.location.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
      if (latLngMatch) {
        location = {
          lat: parseFloat(latLngMatch[1]),
          lng: parseFloat(latLngMatch[2]),
        };
      } else {
        // Geocode the location string (with rate limiting)
        await this.rateLimiter.throttle();
        location = await retryWithBackoff(() => this.client.geocode(request.location));
        metrics.geocodeCalls += 1;
      }

      // Generate cache key
      const cacheKey = generateCacheKey(request, location);

      // Create search run and fetch from API.
      const searchRun = await prisma.searchRun.create({
        data: {
          createdByUserId: userId,
          queryText: request.businessType || null,
          locationText: request.location,
          lat: location.lat,
          lng: location.lng,
          radiusMeters: request.radius,
          types: request.businessType ? [request.businessType] : [],
          status: 'started',
          cacheKey,
          usedCachedResults: false,
        },
      });

      try {
        // Search for places with pagination so repeated searches can still find uncached leads.
        const places: GooglePlaceResult[] = [];
        const seenPlaceIds = new Set<string>();
        let nextPageToken: string | undefined;
        let hasNextPage = true;

        while (hasNextPage) {
          if (nextPageToken) {
            // Google next_page_token can require a short delay before becoming valid.
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }

          await this.rateLimiter.throttle();
          const nearbyResponse = await retryWithBackoff(() =>
            this.client.nearbySearch(
              location,
              request.radius,
              request.businessType,
              nextPageToken
            )
          );
          metrics.nearbySearchCalls += 1;

          for (const place of nearbyResponse.results) {
            if (place.place_id) {
              if (seenPlaceIds.has(place.place_id)) {
                continue;
              }
              seenPlaceIds.add(place.place_id);
            }
            places.push(place);
          }

          nextPageToken = nearbyResponse.nextPageToken;
          hasNextPage = !!nextPageToken;
        }

        const configuredMaxBusinesses = request.maxBusinesses;
        const maxBusinesses = Number.isInteger(configuredMaxBusinesses)
          ? Math.max(1, Math.min(20, configuredMaxBusinesses as number))
          : 20;
        const reachedEndOfResults = places.length <= maxBusinesses;

        const excludedBusinessTypes = await getExcludedBusinessTypes();
        const excludedBusinessTypeSet = new Set(
          excludedBusinessTypes.map((type) => type.trim().toLowerCase())
        );

        const placeIds = places
          .map((place) => place.place_id)
          .filter((placeId): placeId is string => !!placeId);

        const existingPlaceIds = placeIds.length
          ? new Set(
              (
                await prisma.business.findMany({
                  where: { placeId: { in: placeIds } },
                  select: { placeId: true },
                })
              )
                .map((business) => business.placeId)
                .filter((placeId): placeId is string => !!placeId)
            )
          : new Set<string>();

        // Persist to database with deduplication
        const results: BusinessResult[] = [];
        const placeIdsToCache: string[] = [];
        let newCount = 0;
        let existingCount = 0;

        const persistBusiness = async (
          norm: ReturnType<typeof normalizeGooglePlace>,
          exclusionCheck?: {
            isExcluded: boolean;
            reason?: string;
            exclusionMode?: 'business_name' | 'business_type';
          }
        ): Promise<BusinessResult | null> => {
          // Calculate score
          const scoringResult = calculateScore({
            name: norm.name,
            reviewCount: norm.reviewCount,
            businessTypes: norm.businessTypes,
            website: norm.website,
          });

          const leadStatus = exclusionCheck?.isExcluded ? 'rejected' : 'pending';
          const rejectedReason = exclusionCheck?.isExcluded
            ? `Auto-rejected: matched ${exclusionCheck.exclusionMode === 'business_type' ? 'excluded business type' : 'exclude list'} (${exclusionCheck.reason || 'no reason provided'})`
            : undefined;

          const business = await prisma.business.create({
            data: {
              ...toPrismaCreateInput(norm, searchRun.id),
              smallBusinessScore: scoringResult.score,
              websiteStatus: scoringResult.isVIP ? 'no_website' : norm.websiteStatus,
              leadStatus,
              rejectedAt: exclusionCheck?.isExcluded ? new Date() : undefined,
              rejectedReason,
              cachedAt: new Date(),
            },
          });
          newCount++;

          if (business.placeId) {
            placeIdsToCache.push(business.placeId);
          }

          if (!exclusionCheck?.isExcluded) {
            if (business.website) {
              await this.jobQueue.enqueueJob({
                businessId: business.id,
                jobType: 'website_validation',
              });
              await this.jobQueue.enqueueJob({
                businessId: business.id,
                jobType: 'email_scraping',
              });
              await this.jobQueue.enqueueJob({
                businessId: business.id,
                jobType: 'social_scraping',
              });
            }
          }

          if (exclusionCheck?.exclusionMode === 'business_type') {
            return null;
          }

          return {
            placeId: business.placeId || '',
            name: business.name,
            address: business.address,
            lat: business.lat ? Number(business.lat) : 0,
            lng: business.lng ? Number(business.lng) : 0,
            phone: business.phone || undefined,
            website: business.website || undefined,
            businessTypes: business.businessTypes,
            rating: business.rating || undefined,
            reviewCount: business.reviewCount || undefined,
            hasWebsite: !!business.website,
            isNew: true,
            isCached: false,
          };
        };

        for (const place of places) {
          if (results.length >= maxBusinesses) {
            break;
          }

          if (place.place_id && existingPlaceIds.has(place.place_id)) {
            existingCount += 1;
            continue;
          }

          try {
            const nearbyTypes = place.types || [];
            const matchedExcludedType = nearbyTypes.find((type) =>
              excludedBusinessTypeSet.has(type.trim().toLowerCase())
            );

            let candidatePlace = place;
            let exclusionCheck:
              | {
                  isExcluded: boolean;
                  reason?: string;
                  exclusionMode?: 'business_name' | 'business_type';
                }
              | undefined;

            if (place.place_id) {
              metrics.detailsCandidates += 1;
            }

            if (matchedExcludedType) {
              exclusionCheck = {
                isExcluded: true,
                exclusionMode: 'business_type',
                reason: 'Matched excluded business type',
              };
            } else if (place.place_id) {
              try {
                metrics.detailsSelected += 1;
                await this.rateLimiter.throttle();
                metrics.placeDetailsCalls += 1;
                const details = await retryWithBackoff(() => this.client.getPlaceDetails(place.place_id));

                if (details) {
                  candidatePlace = {
                    ...place,
                    ...details,
                    types: details.types && details.types.length > 0 ? details.types : place.types,
                  };
                }
              } catch (error) {
                metrics.placeDetailsFailures += 1;
                console.warn(`Could not fetch place details for ${place.place_id}:`, error);
              }
            }

            const norm = normalizeGooglePlace(candidatePlace);

            if (!exclusionCheck) {
              const exclusionResults = await checkBusinessExclusionBatchWithTypes([
                {
                  name: norm.name,
                  businessTypes: norm.businessTypes,
                },
              ]);
              exclusionCheck = exclusionResults.get(norm.name);
            }

            const result = await persistBusiness(norm, exclusionCheck);
            if (result) {
              results.push(result);
            }
          } catch (error) {
            console.error(`Error persisting business ${place.place_id}:`, error);
            // Continue with other businesses
          }
        }

        // Update search run status
        await prisma.searchRun.update({
          where: { id: searchRun.id },
          data: {
            status: 'completed',
            completedAt: new Date(),
            resultsFound: results.length,
            resultsSavedNew: newCount,
            resultsDedupedExisting: existingCount,
          },
        });

        return {
          results,
          reachedEndOfResults,
          status: 'success',
          fromCache: false,
          metrics: finalizeMetrics(),
        };
      } catch (error) {
        // Update search run status to failed
        await prisma.searchRun.update({
          where: { id: searchRun.id },
          data: {
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : String(error),
          },
        });
        throw error;
      }
    } catch (error) {
      const errorObj = error as { code?: string; message?: string };
      return {
        results: [],
        status: 'error',
        error: errorObj.message || 'An unknown error occurred',
        metrics: finalizeMetrics(),
      };
    }
  }

  /**
   * Get details for a specific place and persist to database
   */
  async getPlaceDetails(placeId: string): Promise<BusinessResult | null> {
    try {
      // Apply rate limiting
      await this.rateLimiter.throttle();

      const place = await retryWithBackoff(() => this.client.getPlaceDetails(placeId));
      const normalized = normalizeGooglePlace(place);

      // Check if business already exists
      const existing = await prisma.business.findUnique({
        where: { placeId: normalized.placeId },
      });

      let business: Business;
      if (existing) {
        business = await prisma.business.update({
          where: { id: existing.id },
          data: {
            name: normalized.name,
            address: normalized.address,
            lat: normalized.lat,
            lng: normalized.lng,
            phone: normalized.phone,
            website: normalized.website,
            businessTypes: normalized.businessTypes,
            rating: normalized.rating,
            reviewCount: normalized.reviewCount,
            websiteStatus: normalized.websiteStatus,
            cachedAt: new Date(), // Update cache timestamp
          },
        });
      } else {
        business = await prisma.business.create({
          data: {
            ...toPrismaCreateInput(normalized),
            cachedAt: new Date(), // Set initial cache timestamp
          },
        });
      }

      return {
        placeId: business.placeId || '',
        name: business.name,
        address: business.address,
        lat: business.lat ? Number(business.lat) : 0,
        lng: business.lng ? Number(business.lng) : 0,
        phone: business.phone || undefined,
        website: business.website || undefined,
        businessTypes: business.businessTypes,
        rating: business.rating || undefined,
        reviewCount: business.reviewCount || undefined,
        hasWebsite: !!business.website,
        isNew: !existing,
        isCached: false,
      };
    } catch (error) {
      console.error(`Error getting place details for ${placeId}:`, error);
      return null;
    }
  }
}
