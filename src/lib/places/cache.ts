/**
 * Cache utilities for Places API integration
 */

import { prisma } from '../prisma';
import type { SearchRequest, BusinessResult } from './types';
import crypto from 'crypto';

// Cache TTL: 30 days in milliseconds
export const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Generate a unique cache key for a search request
 */
export function generateCacheKey(
  request: SearchRequest,
  location?: { lat: number; lng: number }
): string {
  // Normalize inputs for consistent cache keys
  const searchBy = request.searchBy || 'location';
  const lat = location ? location.lat.toFixed(6) : '';
  const lng = location ? location.lng.toFixed(6) : '';
  const radius = request.radius;
  const query = (searchBy === 'business_name'
    ? request.businessName || ''
    : request.location
  ).toLowerCase().trim();
  const type = (request.businessType || '').toLowerCase().trim();
  const maxBusinesses = Number.isInteger(request.maxBusinesses)
    ? Math.max(1, Math.min(20, request.maxBusinesses as number))
    : 20;
  
  // Create deterministic hash
  const key = `${searchBy}:${query}:${lat}:${lng}:${radius}:${type}:${maxBusinesses}`;
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Check if cached results are available and valid
 */
export async function getCachedResults(
  cacheKey: string
): Promise<{
  searchRun: {
    id: string;
    completedAt: Date | null;
  };
  businesses: BusinessResult[];
} | null> {
  // Find the most recent completed search with this cache key
  const recentSearchRun = await prisma.searchRun.findFirst({
    where: {
      cacheKey,
      status: 'completed',
      completedAt: {
        gte: new Date(Date.now() - CACHE_TTL_MS),
      },
    },
    orderBy: {
      completedAt: 'desc',
    },
    include: {
      businesses: {
        where: {
          // Only include businesses that were cached within TTL
          OR: [
            { cachedAt: { gte: new Date(Date.now() - CACHE_TTL_MS) } },
            { cachedAt: null }, // Include newly discovered businesses
          ],
        },
      },
    },
  });

  if (!recentSearchRun || recentSearchRun.businesses.length === 0) {
    return null;
  }

  // Convert to BusinessResult format
  const businesses: BusinessResult[] = recentSearchRun.businesses.map((b) => ({
    placeId: b.placeId || '',
    name: b.name,
    address: b.address,
    lat: b.lat ? Number(b.lat) : 0,
    lng: b.lng ? Number(b.lng) : 0,
    phone: b.phone || undefined,
    website: b.website || undefined,
    businessTypes: b.businessTypes,
    rating: b.rating || undefined,
    reviewCount: b.reviewCount || undefined,
    hasWebsite: !!b.website,
    isNew: false, // All cached results are existing
    isCached: true,
  }));

  return {
    searchRun: recentSearchRun,
    businesses,
  };
}

/**
 * Check if a business's cached data is stale
 */
export function isCacheStale(cachedAt: Date | null): boolean {
  if (!cachedAt) {
    return true;
  }
  return Date.now() - cachedAt.getTime() > CACHE_TTL_MS;
}

/**
 * Update the cached_at timestamp for businesses
 */
export async function updateBusinessCache(placeIds: string[]): Promise<void> {
  if (placeIds.length === 0) return;

  await prisma.business.updateMany({
    where: {
      placeId: {
        in: placeIds,
      },
    },
    data: {
      cachedAt: new Date(),
    },
  });
}
