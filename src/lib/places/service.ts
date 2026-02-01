/**
 * Business logic for Places API integration
 */

import { PlacesClient } from './client';
import { normalizeGooglePlace, toPrismaCreateInput } from './normalizer';
import type { SearchRequest, SearchResponse, BusinessResult } from './types';
import { prisma } from '../prisma';
import type { Business } from '@prisma/client';
import {
  generateCacheKey,
  getCachedResults,
} from './cache';
import { RateLimiter, retryWithBackoff } from './rate-limiter';

export class PlacesService {
  private client: PlacesClient;
  private rateLimiter: RateLimiter;

  constructor(apiKey?: string) {
    this.client = new PlacesClient(apiKey);
    // Conservative rate limiting: 100ms between calls, max 50 per minute
    this.rateLimiter = new RateLimiter(100, 50);
  }

  /**
   * Search for businesses and persist to database
   */
  async search(
    request: SearchRequest,
    userId: string,
    options: { forceRefresh?: boolean } = {}
  ): Promise<SearchResponse> {
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

        // Normalize results
        const normalized = places.map((place) => normalizeGooglePlace(place));

        // Persist to database with deduplication
        const results: BusinessResult[] = [];
        const placeIdsToCache: string[] = [];
        let newCount = 0;
        let existingCount = 0;

        for (const norm of normalized) {
          try {
            // Try to find existing business by place_id
            const existing = await prisma.business.findUnique({
              where: { placeId: norm.placeId },
            });

            let business: Business;
            if (existing) {
              // Update existing business with latest data
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
                  cachedAt: new Date(), // Update cache timestamp
                },
              });
              existingCount++;
            } else {
              // Create new business
              business = await prisma.business.create({
                data: {
                  ...toPrismaCreateInput(norm, searchRun.id),
                  cachedAt: new Date(), // Set initial cache timestamp
                },
              });
              newCount++;
            }

            if (business.placeId) {
              placeIdsToCache.push(business.placeId);
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
