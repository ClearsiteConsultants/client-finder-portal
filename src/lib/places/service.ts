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
  getCachedResults,
} from './cache';
import { RateLimiter, retryWithBackoff } from './rate-limiter';
import { calculateScore, checkBusinessExclusionBatchWithTypes } from '../scoring';
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

      // Check cache unless force refresh
      if (!options.forceRefresh) {
        const cached = await getCachedResults(cacheKey);
        if (cached) {
          // Create a new search run record that references the cached search
          await prisma.searchRun.create({
            data: {
              createdByUserId: userId,
              queryText: request.businessType || null,
              locationText: request.location,
              lat: location.lat,
              lng: location.lng,
              radiusMeters: request.radius,
              types: request.businessType ? [request.businessType] : [],
              status: 'completed',
              completedAt: new Date(),
              resultsFound: cached.businesses.length,
              resultsSavedNew: 0,
              resultsDedupedExisting: cached.businesses.length,
              cacheKey,
              usedCachedResults: true,
              cachedFromSearchRunId: cached.searchRun.id,
            },
          });

          const cacheAge = cached.searchRun.completedAt
            ? Date.now() - cached.searchRun.completedAt.getTime()
            : 0;

          return {
            results: cached.businesses,
            status: 'success',
            fromCache: true,
            cacheAge,
            metrics: finalizeMetrics(),
          };
        }
      }

      // No valid cache found - create search run and fetch from API
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
        // Search for places (with rate limiting and retry)
        await this.rateLimiter.throttle();
        const places = await retryWithBackoff(() =>
          this.client.nearbySearch(location, request.radius, request.businessType)
        );
        metrics.nearbySearchCalls += 1;

        const enrichmentEnabled = request.detailsEnrichment?.enabled ?? true;
        const onlyWhenMissing = request.detailsEnrichment?.onlyWhenMissing ?? true;
        const configuredMaxPlaces = request.detailsEnrichment?.maxPlaces;
        const maxPlaces = Number.isInteger(configuredMaxPlaces)
          ? Math.max(0, configuredMaxPlaces as number)
          : 20;

        // Nearby Search responses commonly omit website and may only provide `vicinity`.
        // Enrich selected results with Place Details so persisted lead records include fuller data.
        const placesNeedingDetails = places.filter((place) => {
          if (!place.place_id) return false;
          if (!onlyWhenMissing) return true;

          const missingWebsite = !place.website;
          const missingAddress = !place.formatted_address && !place.vicinity;
          const missingPhone = !place.formatted_phone_number && !place.international_phone_number;

          return missingWebsite || missingAddress || missingPhone;
        });
        metrics.detailsCandidates = placesNeedingDetails.length;

        const placesToEnrich = enrichmentEnabled
          ? placesNeedingDetails.slice(0, maxPlaces)
          : [];
        metrics.detailsSelected = placesToEnrich.length;
        const placesToEnrichSet = new Set(placesToEnrich.map((place) => place.place_id));

        const enrichedPlaces: GooglePlaceResult[] = [];
        for (const place of places) {
          let enrichedPlace = place;

          if (place.place_id && placesToEnrichSet.has(place.place_id)) {
            try {
              await this.rateLimiter.throttle();
              metrics.placeDetailsCalls += 1;
              const details = await retryWithBackoff(() => this.client.getPlaceDetails(place.place_id));

              if (details) {
                enrichedPlace = {
                  ...place,
                  ...details,
                  // Keep nearby types if details omits them.
                  types: details.types && details.types.length > 0 ? details.types : place.types,
                };
              }
            } catch (error) {
              metrics.placeDetailsFailures += 1;
              // Continue with nearby-search data if details lookup fails.
              console.warn(`Could not fetch place details for ${place.place_id}:`, error);
            }
          }

          enrichedPlaces.push(enrichedPlace);
        }

        // Normalize results
        const normalized = enrichedPlaces.map((place) => normalizeGooglePlace(place));

        // Check exclusions in batch (name + business type)
        const exclusionResults = await checkBusinessExclusionBatchWithTypes(
          normalized.map((n) => ({
            name: n.name,
            businessTypes: n.businessTypes,
          }))
        );

        // Persist to database with deduplication
        const results: BusinessResult[] = [];
        const placeIdsToCache: string[] = [];
        let newCount = 0;
        let existingCount = 0;

        for (const norm of normalized) {
          try {
            // Check if business is excluded
            const exclusionCheck = exclusionResults.get(norm.name);
            
            // Calculate score
            const scoringResult = calculateScore({
              name: norm.name,
              reviewCount: norm.reviewCount,
              businessTypes: norm.businessTypes,
              website: norm.website,
            });

            // Try to find existing business by place_id
            const existing = await prisma.business.findUnique({
              where: { placeId: norm.placeId },
            });

            let business: Business;
            if (existing) {
              // Update existing business with latest data and scoring
              business = await prisma.business.update({
                where: { id: existing.id },
                data: {
                  name: norm.name,
                  address: norm.address,
                  lat: norm.lat,
                  lng: norm.lng,
                  phone: norm.phone,
                  website: norm.website,
                  businessTypes: norm.businessTypes,
                  rating: norm.rating,
                  reviewCount: norm.reviewCount,
                  smallBusinessScore: scoringResult.score,
                  websiteStatus: scoringResult.isVIP ? 'no_website' : norm.websiteStatus,
                  cachedAt: new Date(), // Update cache timestamp
                },
              });
              existingCount++;
            } else {
              // Create new business with scoring
              // If excluded, auto-reject
              const leadStatus = exclusionCheck?.isExcluded ? 'rejected' : 'pending';
              const rejectedReason = exclusionCheck?.isExcluded 
                ? `Auto-rejected: matched ${exclusionCheck.exclusionMode === 'business_type' ? 'excluded business type' : 'exclude list'} (${exclusionCheck.reason || 'no reason provided'})`
                : undefined;
              
              business = await prisma.business.create({
                data: {
                  ...toPrismaCreateInput(norm, searchRun.id),
                  smallBusinessScore: scoringResult.score,
                  websiteStatus: scoringResult.isVIP ? 'no_website' : norm.websiteStatus,
                  leadStatus,
                  rejectedAt: exclusionCheck?.isExcluded ? new Date() : undefined,
                  rejectedReason,
                  cachedAt: new Date(), // Set initial cache timestamp
                },
              });
              newCount++;
            }

            if (business.placeId) {
              placeIdsToCache.push(business.placeId);
            }

            // Enqueue background validation jobs for this business
            // Only enqueue for non-excluded businesses with potential data to validate
            if (!exclusionCheck?.isExcluded) {
              if (business.website) {
                await this.jobQueue.enqueueJob({
                  businessId: business.id,
                  jobType: 'website_validation',
                });
              }
              // Enqueue email and social scraping for businesses with websites
              if (business.website) {
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

            results.push({
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
            });
          } catch (error) {
            console.error(`Error persisting business ${norm.placeId}:`, error);
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
