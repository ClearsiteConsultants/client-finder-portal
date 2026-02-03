/**
 * Integration tests for Places service with mocked API
 */

import { PlacesService } from './service';
import { PlacesClient } from './client';
import { prisma } from '../prisma';
import type { GooglePlaceResult } from './types';

// Mock the PlacesClient
jest.mock('./client');

// Mock the JobQueueService
jest.mock('../jobs/queue-service', () => ({
  JobQueueService: jest.fn().mockImplementation(() => ({
    enqueueJob: jest.fn().mockResolvedValue('mock-job-id'),
    enqueueJobsBatch: jest.fn().mockResolvedValue([]),
  })),
}));

describe('PlacesService', () => {
  let service: PlacesService;
  let mockClient: jest.Mocked<PlacesClient>;
  let testUserId: string;

  beforeEach(async () => {
    // Create a test user for search runs
    const testUser = await prisma.user.create({
      data: {
        email: 'test-places@example.com',
        name: 'Test Places User',
      },
    });
    testUserId = testUser.id;

    service = new PlacesService();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockClient = (service as any).client as jest.Mocked<PlacesClient>;
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.business.deleteMany({
      where: { placeId: { startsWith: 'TEST_' } },
    });
    await prisma.searchRun.deleteMany({
      where: { locationText: { startsWith: 'TEST_' } },
    });
    await prisma.user.deleteMany({
      where: { email: 'test-places@example.com' },
    });
  });

  describe('search', () => {
    it('searches for businesses and persists to database', async () => {
      const mockResults: GooglePlaceResult[] = [
        {
          place_id: 'TEST_PLACE_1',
          name: 'Test Restaurant',
          formatted_address: '123 Test St, Test City, TS 12345',
          geometry: {
            location: { lat: 40.7128, lng: -74.0060 },
          },
          formatted_phone_number: '(555) 123-4567',
          website: 'https://testrestaurant.com',
          types: ['restaurant', 'food'],
          rating: 4.5,
          user_ratings_total: 100,
        },
      ];

      mockClient.geocode.mockResolvedValue({ lat: 40.7128, lng: -74.0060 });
      mockClient.nearbySearch.mockResolvedValue(mockResults);

      const result = await service.search({
        location: 'TEST_New York, NY',
        radius: 5000,
        businessType: 'restaurant',
      }, testUserId);

      expect(result.status).toBe('success');
      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toMatchObject({
        placeId: 'TEST_PLACE_1',
        name: 'Test Restaurant',
        hasWebsite: true,
        isNew: true,
      });

      // Verify database persistence
      const business = await prisma.business.findUnique({
        where: { placeId: 'TEST_PLACE_1' },
      });

      expect(business).toBeTruthy();
      expect(business?.name).toBe('Test Restaurant');
      expect(business?.leadStatus).toBe('pending');
      expect(business?.source).toBe('google_maps');
    });

    it('handles lat,lng format directly without geocoding', async () => {
      const mockResults: GooglePlaceResult[] = [];
      mockClient.nearbySearch.mockResolvedValue(mockResults);

      await service.search({
        location: '40.7128,-74.0060',
        radius: 1000,
      }, testUserId);

      expect(mockClient.geocode).not.toHaveBeenCalled();
      expect(mockClient.nearbySearch).toHaveBeenCalledWith(
        { lat: 40.7128, lng: -74.0060 },
        1000,
        undefined
      );
    });

    it('deduplicates existing businesses by place_id', async () => {
      // Create existing business
      await prisma.business.create({
        data: {
          placeId: 'TEST_EXISTING',
          name: 'Old Name',
          address: '456 Old St',
          source: 'google_maps',
        },
      });

      const mockResults: GooglePlaceResult[] = [
        {
          place_id: 'TEST_EXISTING',
          name: 'Updated Name',
          formatted_address: '456 New St',
        },
      ];

      mockClient.geocode.mockResolvedValue({ lat: 40.7, lng: -74.0 });
      mockClient.nearbySearch.mockResolvedValue(mockResults);

      const result = await service.search({
        location: 'TEST_Location',
        radius: 1000,
      }, testUserId);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].isNew).toBe(false);
      expect(result.results[0].name).toBe('Updated Name');

      // Verify database update
      const business = await prisma.business.findUnique({
        where: { placeId: 'TEST_EXISTING' },
      });
      expect(business?.name).toBe('Updated Name');
    });

    it('creates search run record with correct status', async () => {
      mockClient.geocode.mockResolvedValue({ lat: 40.7, lng: -74.0 });
      mockClient.nearbySearch.mockResolvedValue([]);

      await service.search({
        location: 'TEST_SearchRun',
        radius: 2000,
        businessType: 'cafe',
      }, testUserId);

      const searchRun = await prisma.searchRun.findFirst({
        where: { locationText: 'TEST_SearchRun' },
      });

      expect(searchRun).toBeTruthy();
      expect(searchRun?.status).toBe('completed');
      expect(searchRun?.radiusMeters).toBe(2000);
      expect(searchRun?.types).toEqual(['cafe']);
    });

    it('handles API errors gracefully', async () => {
      mockClient.geocode.mockRejectedValue({
        code: 'QUOTA_EXCEEDED',
        message: 'API quota exceeded',
      });

      const result = await service.search({
        location: 'TEST_Error',
        radius: 1000,
      }, testUserId);

      expect(result.status).toBe('error');
      expect(result.error).toBeTruthy();
      expect(result.results).toHaveLength(0);
    });

    it('marks search run as failed on error', async () => {
      mockClient.geocode.mockResolvedValue({ lat: 40.7, lng: -74.0 });
      mockClient.nearbySearch.mockRejectedValue(new Error('Network error'));

      await service.search({
        location: 'TEST_FailedSearch',
        radius: 1000,
      }, testUserId);

      const searchRun = await prisma.searchRun.findFirst({
        where: { locationText: 'TEST_FailedSearch' },
      });

      expect(searchRun?.status).toBe('failed');
      expect(searchRun?.errorMessage).toContain('Network error');
    });
  });

  describe('getPlaceDetails', () => {
    it('fetches and persists place details', async () => {
      const mockPlace: GooglePlaceResult = {
        place_id: 'TEST_DETAILS',
        name: 'Detail Business',
        formatted_address: '789 Detail St',
        website: 'https://detail.com',
      };

      mockClient.getPlaceDetails.mockResolvedValue(mockPlace);

      const result = await service.getPlaceDetails('TEST_DETAILS');

      expect(result).toBeTruthy();
      expect(result?.name).toBe('Detail Business');
      expect(result?.isNew).toBe(true);

      const business = await prisma.business.findUnique({
        where: { placeId: 'TEST_DETAILS' },
      });
      expect(business).toBeTruthy();
    });

    it('updates existing business when fetching details', async () => {
      await prisma.business.create({
        data: {
          placeId: 'TEST_UPDATE_DETAILS',
          name: 'Old Details',
          address: '100 Old Detail St',
          source: 'google_maps',
        },
      });

      const mockPlace: GooglePlaceResult = {
        place_id: 'TEST_UPDATE_DETAILS',
        name: 'New Details',
        formatted_address: '100 New Detail St',
      };

      mockClient.getPlaceDetails.mockResolvedValue(mockPlace);

      const result = await service.getPlaceDetails('TEST_UPDATE_DETAILS');

      expect(result?.isNew).toBe(false);
      expect(result?.name).toBe('New Details');
    });

    it('returns null on error', async () => {
      mockClient.getPlaceDetails.mockRejectedValue(new Error('Not found'));

      const result = await service.getPlaceDetails('INVALID');

      expect(result).toBeNull();
    });
  });

  describe('caching', () => {
    it('returns cached results when searching same location within TTL', async () => {
      const mockResults: GooglePlaceResult[] = [
        {
          place_id: 'TEST_CACHE_1',
          name: 'Cached Business',
          formatted_address: '123 Cache St',
        },
      ];

      mockClient.geocode.mockResolvedValue({ lat: 47.6062, lng: -122.3321 });
      mockClient.nearbySearch.mockResolvedValue(mockResults);

      // First search - should call API
      const result1 = await service.search({
        location: 'TEST_Cache_Location',
        radius: 5000,
        businessType: 'restaurant',
      }, testUserId);

      expect(result1.status).toBe('success');
      expect(result1.results).toHaveLength(1);
      expect(result1.fromCache).toBe(false);
      expect(mockClient.nearbySearch).toHaveBeenCalledTimes(1);

      // Second search with same parameters - should use cache
      const result2 = await service.search({
        location: 'TEST_Cache_Location',
        radius: 5000,
        businessType: 'restaurant',
      }, testUserId);

      expect(result2.status).toBe('success');
      expect(result2.results).toHaveLength(1);
      expect(result2.fromCache).toBe(true);
      expect(result2.cacheAge).toBeDefined();
      expect(result2.results[0].isCached).toBe(true);
      // API should not be called again
      expect(mockClient.nearbySearch).toHaveBeenCalledTimes(1);

      // Verify search run records
      const searchRuns = await prisma.searchRun.findMany({
        where: { locationText: 'TEST_Cache_Location' },
        orderBy: { createdAt: 'asc' },
      });

      expect(searchRuns).toHaveLength(2);
      expect(searchRuns[0].usedCachedResults).toBe(false);
      expect(searchRuns[0].cacheKey).toBeTruthy();
      expect(searchRuns[1].usedCachedResults).toBe(true);
      expect(searchRuns[1].cachedFromSearchRunId).toBe(searchRuns[0].id);
      expect(searchRuns[1].cacheKey).toBe(searchRuns[0].cacheKey);
    });

    it('bypasses cache when forceRefresh is true', async () => {
      const mockResults: GooglePlaceResult[] = [
        {
          place_id: 'TEST_FORCE_REFRESH',
          name: 'Refreshed Business',
          formatted_address: '456 Refresh St',
        },
      ];

      mockClient.geocode.mockResolvedValue({ lat: 47.6062, lng: -122.3321 });
      mockClient.nearbySearch.mockResolvedValue(mockResults);

      // First search
      await service.search({
        location: 'TEST_Force_Refresh',
        radius: 5000,
      }, testUserId);

      // Second search with forceRefresh should call API again
      const result = await service.search(
        {
          location: 'TEST_Force_Refresh',
          radius: 5000,
        },
        testUserId,
        { forceRefresh: true }
      );

      expect(result.fromCache).toBe(false);
      expect(mockClient.nearbySearch).toHaveBeenCalledTimes(2);
    });

    it('generates different cache keys for different parameters', async () => {
      mockClient.geocode.mockResolvedValue({ lat: 47.6062, lng: -122.3321 });
      mockClient.nearbySearch.mockResolvedValue([]);

      // Search with different parameters
      await service.search({
        location: 'TEST_Different_Cache',
        radius: 5000,
        businessType: 'restaurant',
      }, testUserId);

      await service.search({
        location: 'TEST_Different_Cache',
        radius: 5000,
        businessType: 'cafe',
      }, testUserId);

      await service.search({
        location: 'TEST_Different_Cache',
        radius: 10000,
        businessType: 'restaurant',
      }, testUserId);

      // Each should have different cache keys
      const searchRuns = await prisma.searchRun.findMany({
        where: { locationText: 'TEST_Different_Cache' },
      });

      expect(searchRuns).toHaveLength(3);
      const cacheKeys = searchRuns.map(sr => sr.cacheKey);
      expect(new Set(cacheKeys).size).toBe(3); // All unique
    });

    it('updates cachedAt timestamp when fetching fresh data', async () => {
      const mockResults: GooglePlaceResult[] = [
        {
          place_id: 'TEST_TIMESTAMP',
          name: 'Timestamp Business',
          formatted_address: '789 Time St',
        },
      ];

      mockClient.geocode.mockResolvedValue({ lat: 47.6062, lng: -122.3321 });
      mockClient.nearbySearch.mockResolvedValue(mockResults);

      await service.search({
        location: 'TEST_Timestamp',
        radius: 5000,
      }, testUserId);

      const business = await prisma.business.findUnique({
        where: { placeId: 'TEST_TIMESTAMP' },
      });

      expect(business?.cachedAt).toBeTruthy();
      expect(business?.cachedAt).toBeInstanceOf(Date);
    });
  });
});
