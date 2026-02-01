/**
 * Tests for cache utilities
 */

import { generateCacheKey, isCacheStale, CACHE_TTL_MS } from './cache';
import type { SearchRequest } from './types';

describe('Cache utilities', () => {
  describe('generateCacheKey', () => {
    it('generates consistent cache keys for same inputs', () => {
      const request: SearchRequest = {
        location: 'Seattle, WA',
        radius: 5000,
        businessType: 'restaurant',
      };
      const location = { lat: 47.6062, lng: -122.3321 };

      const key1 = generateCacheKey(request, location);
      const key2 = generateCacheKey(request, location);

      expect(key1).toBe(key2);
      expect(key1).toHaveLength(64); // SHA256 hex digest
    });

    it('generates different keys for different locations', () => {
      const request: SearchRequest = {
        location: 'Seattle, WA',
        radius: 5000,
        businessType: 'restaurant',
      };

      const key1 = generateCacheKey(request, { lat: 47.6062, lng: -122.3321 });
      const key2 = generateCacheKey(request, { lat: 40.7128, lng: -74.006 });

      expect(key1).not.toBe(key2);
    });

    it('generates different keys for different radii', () => {
      const location = { lat: 47.6062, lng: -122.3321 };

      const key1 = generateCacheKey(
        { location: 'Seattle', radius: 5000, businessType: 'restaurant' },
        location
      );
      const key2 = generateCacheKey(
        { location: 'Seattle', radius: 10000, businessType: 'restaurant' },
        location
      );

      expect(key1).not.toBe(key2);
    });

    it('generates different keys for different business types', () => {
      const request = { location: 'Seattle', radius: 5000 };
      const location = { lat: 47.6062, lng: -122.3321 };

      const key1 = generateCacheKey(
        { ...request, businessType: 'restaurant' },
        location
      );
      const key2 = generateCacheKey(
        { ...request, businessType: 'cafe' },
        location
      );

      expect(key1).not.toBe(key2);
    });

    it('generates same key when business type is normalized', () => {
      const request = { location: 'Seattle', radius: 5000 };
      const location = { lat: 47.6062, lng: -122.3321 };

      const key1 = generateCacheKey(
        { ...request, businessType: 'Restaurant' },
        location
      );
      const key2 = generateCacheKey(
        { ...request, businessType: 'restaurant' },
        location
      );
      const key3 = generateCacheKey(
        { ...request, businessType: ' RESTAURANT ' },
        location
      );

      expect(key1).toBe(key2);
      expect(key1).toBe(key3);
    });

    it('generates same key when business type is undefined or empty', () => {
      const location = { lat: 47.6062, lng: -122.3321 };

      const key1 = generateCacheKey(
        { location: 'Seattle', radius: 5000, businessType: undefined },
        location
      );
      const key2 = generateCacheKey(
        { location: 'Seattle', radius: 5000, businessType: '' },
        location
      );

      expect(key1).toBe(key2);
    });

    it('rounds coordinates to 6 decimal places for consistency', () => {
      const request: SearchRequest = {
        location: 'Seattle',
        radius: 5000,
      };

      // These should produce the same cache key due to rounding
      const key1 = generateCacheKey(request, { lat: 47.606200001, lng: -122.332100001 });
      const key2 = generateCacheKey(request, { lat: 47.606199999, lng: -122.332099999 });

      expect(key1).toBe(key2);
    });
  });

  describe('isCacheStale', () => {
    it('returns true for null cachedAt', () => {
      expect(isCacheStale(null)).toBe(true);
    });

    it('returns true for dates older than TTL', () => {
      const oldDate = new Date(Date.now() - CACHE_TTL_MS - 1000);
      expect(isCacheStale(oldDate)).toBe(true);
    });

    it('returns false for dates within TTL', () => {
      const recentDate = new Date(Date.now() - CACHE_TTL_MS + 60000); // 1 minute before expiry
      expect(isCacheStale(recentDate)).toBe(false);
    });

    it('returns false for current date', () => {
      const now = new Date();
      expect(isCacheStale(now)).toBe(false);
    });
  });
});
