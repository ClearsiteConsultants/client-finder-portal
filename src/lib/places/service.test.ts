/**
 * Integration tests for Places service with mocked API
 */

import { PlacesService } from './service';
import { PlacesClient } from './client';
import { disconnectPrisma, prisma } from '../prisma';
import type { GooglePlaceResult } from './types';
import { addBusinessTypeToExcludeList } from '../scoring/exclusions';

// Mock the PlacesClient
jest.mock('./client');

// Mock the JobQueueService
jest.mock('../jobs/queue-service', () => ({
  JobQueueService: jest.fn().mockImplementation(() => ({
    enqueueJob: jest.fn().mockResolvedValue('mock-job-id'),
    enqueueJobsBatch: jest.fn().mockResolvedValue([]),
  })),
}));

jest.setTimeout(35000);

describe('PlacesService', () => {
  let service: PlacesService;
  let mockClient: jest.Mocked<PlacesClient>;
  let testUserId: string;

  afterAll(async () => {
    await disconnectPrisma();
  });

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
    await prisma.excludedBusiness.deleteMany({
      where: { addedByUserId: testUserId },
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
      mockClient.nearbySearch.mockResolvedValue({ results: mockResults });

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
      expect(result.metrics).toMatchObject({
        geocodeCalls: 1,
        nearbySearchCalls: 1,
        placeDetailsCalls: 1,
        placeDetailsFailures: 0,
        detailsCandidates: 1,
        detailsSelected: 1,
        totalGooglePlacesCalls: 3,
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
      mockClient.nearbySearch.mockResolvedValue({ results: mockResults });

      await service.search({
        location: '40.7128,-74.0060',
        radius: 1000,
      }, testUserId);

      expect(mockClient.geocode).not.toHaveBeenCalled();
      expect(mockClient.nearbySearch).toHaveBeenCalledWith(
        { lat: 40.7128, lng: -74.0060 },
        1000,
        undefined,
        undefined
      );
    });

    it('skips existing businesses by place_id and returns only uncached leads', async () => {
      // Create existing business
      await prisma.business.create({
        data: {
          placeId: 'TEST_EXISTING',
          name: 'Old Name',
          address: '456 Old St',
          websiteStatus: 'no_website',
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
      mockClient.nearbySearch.mockResolvedValue({ results: mockResults });

      const result = await service.search({
        location: 'TEST_Location',
        radius: 1000,
      }, testUserId);

      expect(result.results).toHaveLength(0);
      expect(mockClient.getPlaceDetails).not.toHaveBeenCalled();

      // Verify database was not updated/enhanced
      const business = await prisma.business.findUnique({
        where: { placeId: 'TEST_EXISTING' },
      });
      expect(business?.name).toBe('Old Name');
    });

    it('enriches nearby results with place details before persisting', async () => {
      const nearbyResults: GooglePlaceResult[] = [
        {
          place_id: 'TEST_ENRICHED',
          name: 'Nearby Only Business',
          vicinity: '12 Nearby Rd',
          geometry: {
            location: { lat: 34.0522, lng: -118.2437 },
          },
        },
      ];

      const detailsResult: GooglePlaceResult = {
        place_id: 'TEST_ENRICHED',
        name: 'Nearby Only Business',
        formatted_address: '12 Nearby Rd, Los Angeles, CA',
        website: 'https://nearby-only-business.test',
      };

      mockClient.geocode.mockResolvedValue({ lat: 34.0522, lng: -118.2437 });
      mockClient.nearbySearch.mockResolvedValue({ results: nearbyResults });
      mockClient.getPlaceDetails.mockResolvedValue(detailsResult);

      const result = await service.search(
        {
          location: 'TEST_Enrichment',
          radius: 3000,
        },
        testUserId
      );

      expect(result.status).toBe('success');
      expect(result.results).toHaveLength(1);
      expect(result.results[0].address).toBe('12 Nearby Rd, Los Angeles, CA');
      expect(result.results[0].website).toBe('https://nearby-only-business.test');
      expect(result.metrics).toMatchObject({
        geocodeCalls: 1,
        nearbySearchCalls: 1,
        placeDetailsCalls: 1,
        placeDetailsFailures: 0,
        detailsCandidates: 1,
        detailsSelected: 1,
        totalGooglePlacesCalls: 3,
      });

      const business = await prisma.business.findUnique({
        where: { placeId: 'TEST_ENRICHED' },
      });

      expect(business?.address).toBe('12 Nearby Rd, Los Angeles, CA');
      expect(business?.website).toBe('https://nearby-only-business.test');
    });

    it('keeps non-no_website status when ingested lead has a website URL', async () => {
      const mockResults: GooglePlaceResult[] = [
        {
          place_id: 'TEST_WEBSITE_STATUS_WITH_URL',
          name: 'Website Status Lead',
          formatted_address: '101 Status St',
          website: 'https://status-lead.test',
          user_ratings_total: 15,
          types: ['store'],
        },
      ];

      mockClient.geocode.mockResolvedValue({ lat: 40.7128, lng: -74.0060 });
      mockClient.nearbySearch.mockResolvedValue({ results: mockResults });
      mockClient.getPlaceDetails.mockResolvedValue(mockResults[0]);

      const result = await service.search(
        {
          location: 'TEST_Website_Status_With_URL',
          radius: 3000,
        },
        testUserId
      );

      expect(result.status).toBe('success');
      const business = await prisma.business.findUnique({
        where: { placeId: 'TEST_WEBSITE_STATUS_WITH_URL' },
      });

      expect(business?.website).toBe('https://status-lead.test');
      expect(business?.websiteStatus).not.toBe('no_website');
    });

    it('enriches all selected uncached businesses', async () => {
      const nearbyResults: GooglePlaceResult[] = [
        { place_id: 'TEST_LIMIT_1', name: 'Limit 1', vicinity: 'A' },
        { place_id: 'TEST_LIMIT_2', name: 'Limit 2', vicinity: 'B' },
        { place_id: 'TEST_LIMIT_3', name: 'Limit 3', vicinity: 'C' },
      ];

      mockClient.geocode.mockResolvedValue({ lat: 34.0522, lng: -118.2437 });
      mockClient.nearbySearch.mockResolvedValue({ results: nearbyResults });
      mockClient.getPlaceDetails
        .mockResolvedValueOnce({
          place_id: 'TEST_LIMIT_1',
          name: 'Limit 1',
          formatted_address: 'Limit 1 Address',
          website: 'https://limit-1.test',
        })
        .mockResolvedValueOnce({
          place_id: 'TEST_LIMIT_2',
          name: 'Limit 2',
          formatted_address: 'Limit 2 Address',
          website: 'https://limit-2.test',
        })
        .mockResolvedValueOnce({
          place_id: 'TEST_LIMIT_3',
          name: 'Limit 3',
          formatted_address: 'Limit 3 Address',
          website: 'https://limit-3.test',
        });

      await service.search(
        {
          location: 'TEST_Limit_Enrichment',
          radius: 3000,
        },
        testUserId
      );

      expect(mockClient.getPlaceDetails).toHaveBeenCalledTimes(3);
    });

    it('skips place details enrichment for already cached place IDs', async () => {
      await prisma.business.create({
        data: {
          placeId: 'TEST_CACHED_SKIP_1',
          name: 'Cached Lead',
          address: '100 Cached St',
          websiteStatus: 'no_website',
          source: 'google_maps',
          cachedAt: new Date(),
        },
      });

      const nearbyResults: GooglePlaceResult[] = [
        {
          place_id: 'TEST_CACHED_SKIP_1',
          name: 'Cached Lead Updated',
          vicinity: 'Cached',
        },
        {
          place_id: 'TEST_CACHED_SKIP_2',
          name: 'Fresh Lead',
          vicinity: 'Fresh',
        },
      ];

      mockClient.geocode.mockResolvedValue({ lat: 34.0522, lng: -118.2437 });
      mockClient.nearbySearch.mockResolvedValue({ results: nearbyResults });
      mockClient.getPlaceDetails.mockResolvedValue({
        place_id: 'TEST_CACHED_SKIP_2',
        name: 'Fresh Lead',
        formatted_address: '200 Fresh St',
      });

      const result = await service.search(
        {
          location: 'TEST_Skip_Cached_Enrichment',
          radius: 3000,
        },
        testUserId
      );

      expect(result.status).toBe('success');
      expect(result.results).toHaveLength(1);
      expect(result.results[0].placeId).toBe('TEST_CACHED_SKIP_2');
      expect(mockClient.getPlaceDetails).toHaveBeenCalledTimes(1);
      expect(mockClient.getPlaceDetails).toHaveBeenCalledWith('TEST_CACHED_SKIP_2');
    });

    it('respects maxBusinesses limit for processed results', async () => {
      const nearbyResults: GooglePlaceResult[] = [
        {
          place_id: 'TEST_NO_ENRICH',
          name: 'No Enrich Business',
          vicinity: '99 No Enrich Rd',
        },
        {
          place_id: 'TEST_NO_ENRICH_2',
          name: 'No Enrich Business 2',
          vicinity: '100 No Enrich Rd',
        },
      ];

      mockClient.geocode.mockResolvedValue({ lat: 34.0522, lng: -118.2437 });
      mockClient.nearbySearch.mockResolvedValue({ results: nearbyResults });
      mockClient.getPlaceDetails.mockResolvedValue({
        place_id: 'TEST_NO_ENRICH',
        name: 'No Enrich Business',
        formatted_address: '99 No Enrich Rd',
      });

      const result = await service.search(
        {
          location: 'TEST_No_Enrichment',
          radius: 3000,
          maxBusinesses: 1,
        },
        testUserId
      );

      expect(result.status).toBe('success');
      expect(result.results).toHaveLength(1);
      expect(mockClient.getPlaceDetails).toHaveBeenCalledTimes(1);
    });

    it('skips Place Details enrichment for nearby results with excluded business types', async () => {
      await addBusinessTypeToExcludeList('restaurant', testUserId, 'Skip details for excluded type');

      const nearbyResults: GooglePlaceResult[] = [
        {
          place_id: 'TEST_SKIP_DETAILS_1',
          name: 'Excluded Restaurant',
          vicinity: 'Skip 1',
          types: ['restaurant', 'food'],
        },
        {
          place_id: 'TEST_SKIP_DETAILS_2',
          name: 'Allowed Clinic',
          vicinity: 'Skip 2',
          types: ['doctor'],
        },
      ];

      mockClient.geocode.mockResolvedValue({ lat: 40.7, lng: -74.0 });
      mockClient.nearbySearch.mockResolvedValue({ results: nearbyResults });
      mockClient.getPlaceDetails.mockResolvedValue({
        place_id: 'TEST_SKIP_DETAILS_2',
        name: 'Allowed Clinic',
        formatted_address: 'Skip 2 Address',
      });

      const result = await service.search(
        {
          location: 'TEST_Skip_Excluded_Enrichment',
          radius: 1000,
        },
        testUserId
      );

      expect(result.status).toBe('success');
      expect(result.metrics).toMatchObject({
        detailsCandidates: 2,
        detailsSelected: 1,
        placeDetailsCalls: 1,
      });
      expect(mockClient.getPlaceDetails).toHaveBeenCalledTimes(1);
      expect(mockClient.getPlaceDetails).toHaveBeenCalledWith('TEST_SKIP_DETAILS_2');
    });

    it('replaces excluded business-type results with later nearby results to satisfy maxBusinesses', async () => {
      await addBusinessTypeToExcludeList('restaurant', testUserId, 'Excluded from visible results');

      const nearbyResults: GooglePlaceResult[] = [
        {
          place_id: 'TEST_REPLACE_1',
          name: 'Excluded Restaurant',
          vicinity: 'Replace 1',
          types: ['restaurant'],
        },
        {
          place_id: 'TEST_REPLACE_2',
          name: 'Allowed Clinic',
          vicinity: 'Replace 2',
          types: ['doctor'],
        },
        {
          place_id: 'TEST_REPLACE_3',
          name: 'Allowed Store',
          vicinity: 'Replace 3',
          types: ['store'],
        },
      ];

      mockClient.geocode.mockResolvedValue({ lat: 40.7, lng: -74.0 });
      mockClient.nearbySearch.mockResolvedValue({ results: nearbyResults });
      mockClient.getPlaceDetails
        .mockResolvedValueOnce({
          place_id: 'TEST_REPLACE_2',
          name: 'Allowed Clinic',
          formatted_address: 'Replace 2 Address',
          types: ['doctor'],
        })
        .mockResolvedValueOnce({
          place_id: 'TEST_REPLACE_3',
          name: 'Allowed Store',
          formatted_address: 'Replace 3 Address',
          types: ['store'],
        });

      const result = await service.search(
        {
          location: 'TEST_Replace_Excluded_Results',
          radius: 1000,
          maxBusinesses: 2,
        },
        testUserId
      );

      expect(result.status).toBe('success');
      expect(result.results).toHaveLength(2);
      expect(result.results.map((business) => business.placeId)).toEqual([
        'TEST_REPLACE_2',
        'TEST_REPLACE_3',
      ]);
      expect(result.results.some((business) => business.placeId === 'TEST_REPLACE_1')).toBe(false);
      expect(mockClient.getPlaceDetails).toHaveBeenCalledTimes(2);
    });

    it('creates search run record with correct status', async () => {
      mockClient.geocode.mockResolvedValue({ lat: 40.7, lng: -74.0 });
      mockClient.nearbySearch.mockResolvedValue({ results: [] });

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
          websiteStatus: 'no_website',
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

    it('preserves existing website and websiteStatus when Google details has no website', async () => {
      await prisma.business.create({
        data: {
          placeId: 'TEST_PRESERVE_WEBSITE_DETAILS',
          name: 'Existing Website Lead',
          address: '200 Existing Site St',
          website: 'https://existing-site.test',
          websiteStatus: 'acceptable',
          source: 'google_maps',
        },
      });

      const mockPlace: GooglePlaceResult = {
        place_id: 'TEST_PRESERVE_WEBSITE_DETAILS',
        name: 'Existing Website Lead Updated',
        formatted_address: '200 Existing Site St Updated',
      };

      mockClient.getPlaceDetails.mockResolvedValue(mockPlace);

      const result = await service.getPlaceDetails('TEST_PRESERVE_WEBSITE_DETAILS');

      expect(result?.isNew).toBe(false);
      expect(result?.website).toBe('https://existing-site.test');

      const business = await prisma.business.findUnique({
        where: { placeId: 'TEST_PRESERVE_WEBSITE_DETAILS' },
      });

      expect(business?.website).toBe('https://existing-site.test');
      expect(business?.websiteStatus).toBe('acceptable');
    });

    it('returns null on error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockClient.getPlaceDetails.mockRejectedValue(
        new Error('Not found')
      );

      const result = await service.getPlaceDetails('INVALID');

      expect(result).toBeNull();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('caching', () => {
    it('does not replay cached results for repeated searches', async () => {
      const mockResults: GooglePlaceResult[] = [
        {
          place_id: 'TEST_CACHE_1',
          name: 'Cached Business',
          formatted_address: '123 Cache St',
        },
      ];

      mockClient.geocode.mockResolvedValue({ lat: 47.6062, lng: -122.3321 });
      mockClient.nearbySearch.mockResolvedValue({ results: mockResults });

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

      // Second search with same parameters should fetch again and skip existing place IDs
      const result2 = await service.search({
        location: 'TEST_Cache_Location',
        radius: 5000,
        businessType: 'restaurant',
      }, testUserId);

      expect(result2.status).toBe('success');
      expect(result2.results).toHaveLength(0);
      expect(result2.fromCache).toBe(false);
      // API should be called again to discover uncached leads
      expect(mockClient.nearbySearch).toHaveBeenCalledTimes(2);

      // Verify search run records
      const searchRuns = await prisma.searchRun.findMany({
        where: { locationText: 'TEST_Cache_Location' },
        orderBy: { createdAt: 'asc' },
      });

      expect(searchRuns).toHaveLength(2);
      expect(searchRuns[0].usedCachedResults).toBe(false);
      expect(searchRuns[0].cacheKey).toBeTruthy();
      expect(searchRuns[1].usedCachedResults).toBe(false);
      expect(searchRuns[1].cachedFromSearchRunId).toBeNull();
      expect(searchRuns[1].cacheKey).toBe(searchRuns[0].cacheKey);
    });

    it('finds uncached leads on later nearby pages for repeated all-types searches', async () => {
      const firstPage: GooglePlaceResult[] = [
        {
          place_id: 'TEST_ALL_TYPES_PAGE_1',
          name: 'Page One Business',
          formatted_address: '100 Page One St',
        },
      ];

      const secondPageNewLead: GooglePlaceResult[] = [
        {
          place_id: 'TEST_ALL_TYPES_PAGE_2_NEW',
          name: 'Page Two New Business',
          formatted_address: '200 Page Two St',
        },
      ];

      mockClient.geocode.mockResolvedValue({ lat: 47.6062, lng: -122.3321 });

      // First run persists page 1 result.
      mockClient.nearbySearch.mockResolvedValueOnce({ results: firstPage });
      await service.search(
        {
          location: 'TEST_All_Types_Pagination',
          radius: 5000,
        },
        testUserId
      );

      // Second run gets same first page (cached in DB), then follows next page token to a new lead.
      mockClient.nearbySearch
        .mockResolvedValueOnce({ results: firstPage, nextPageToken: 'PAGE_2_TOKEN' })
        .mockResolvedValueOnce({ results: secondPageNewLead });

      const secondRun = await service.search(
        {
          location: 'TEST_All_Types_Pagination',
          radius: 5000,
        },
        testUserId
      );

      expect(secondRun.status).toBe('success');
      expect(secondRun.results).toHaveLength(1);
      expect(secondRun.results[0].placeId).toBe('TEST_ALL_TYPES_PAGE_2_NEW');
      expect(mockClient.nearbySearch).toHaveBeenCalledTimes(3);
      expect(mockClient.nearbySearch).toHaveBeenNthCalledWith(
        3,
        { lat: 47.6062, lng: -122.3321 },
        5000,
        undefined,
        'PAGE_2_TOKEN'
      );
    });

    it('fetches all available nearby search pages when next page tokens continue', async () => {
      mockClient.geocode.mockResolvedValue({ lat: 47.6062, lng: -122.3321 });

      mockClient.nearbySearch
        .mockResolvedValueOnce({
          results: [
            { place_id: 'TEST_ALL_PAGES_1', name: 'All Pages 1', formatted_address: 'P1' },
          ],
          nextPageToken: 'TOKEN_2',
        })
        .mockResolvedValueOnce({
          results: [
            { place_id: 'TEST_ALL_PAGES_2', name: 'All Pages 2', formatted_address: 'P2' },
          ],
          nextPageToken: 'TOKEN_3',
        })
        .mockResolvedValueOnce({
          results: [
            { place_id: 'TEST_ALL_PAGES_3', name: 'All Pages 3', formatted_address: 'P3' },
          ],
          nextPageToken: 'TOKEN_4',
        })
        .mockResolvedValueOnce({
          results: [
            { place_id: 'TEST_ALL_PAGES_4', name: 'All Pages 4', formatted_address: 'P4' },
          ],
        });

      const result = await service.search(
        {
          location: 'TEST_All_Nearby_Pages',
          radius: 5000,
          maxBusinesses: 4,
        },
        testUserId
      );

      expect(result.status).toBe('success');
      expect(result.results).toHaveLength(4);
      expect(result.results.map((business) => business.placeId)).toEqual([
        'TEST_ALL_PAGES_1',
        'TEST_ALL_PAGES_2',
        'TEST_ALL_PAGES_3',
        'TEST_ALL_PAGES_4',
      ]);
      expect(mockClient.nearbySearch).toHaveBeenCalledTimes(4);
      expect(mockClient.nearbySearch).toHaveBeenNthCalledWith(
        2,
        { lat: 47.6062, lng: -122.3321 },
        5000,
        undefined,
        'TOKEN_2'
      );
      expect(mockClient.nearbySearch).toHaveBeenNthCalledWith(
        3,
        { lat: 47.6062, lng: -122.3321 },
        5000,
        undefined,
        'TOKEN_3'
      );
      expect(mockClient.nearbySearch).toHaveBeenNthCalledWith(
        4,
        { lat: 47.6062, lng: -122.3321 },
        5000,
        undefined,
        'TOKEN_4'
      );
    });

    it('continues to fetch fresh results when forceRefresh is true', async () => {
      const mockResults: GooglePlaceResult[] = [
        {
          place_id: 'TEST_FORCE_REFRESH',
          name: 'Refreshed Business',
          formatted_address: '456 Refresh St',
        },
      ];

      mockClient.geocode.mockResolvedValue({ lat: 47.6062, lng: -122.3321 });
      mockClient.nearbySearch.mockResolvedValue({ results: mockResults });

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
      mockClient.nearbySearch.mockResolvedValue({ results: [] });

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
      mockClient.nearbySearch.mockResolvedValue({ results: mockResults });

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

    it('filters excluded business-type entries from fresh results', async () => {
      const mockResults: GooglePlaceResult[] = [
        {
          place_id: 'TEST_CACHE_FILTER_1',
          name: 'Cached Restaurant',
          formatted_address: '123 Cache St',
          types: ['restaurant'],
        },
        {
          place_id: 'TEST_CACHE_FILTER_2',
          name: 'Cached Clinic',
          formatted_address: '456 Cache St',
          types: ['doctor'],
        },
      ];

      mockClient.geocode.mockResolvedValue({ lat: 47.6062, lng: -122.3321 });
      mockClient.nearbySearch.mockResolvedValue({ results: mockResults });
      mockClient.getPlaceDetails
        .mockResolvedValueOnce({
          place_id: 'TEST_CACHE_FILTER_1',
          name: 'Cached Restaurant',
          formatted_address: '123 Cache St',
          types: ['restaurant'],
        })
        .mockResolvedValueOnce({
          place_id: 'TEST_CACHE_FILTER_2',
          name: 'Cached Clinic',
          formatted_address: '456 Cache St',
          types: ['doctor'],
        });

      const firstResult = await service.search(
        {
          location: 'TEST_Cache_Filter_Location',
          radius: 5000,
        },
        testUserId
      );

      expect(firstResult.fromCache).toBe(false);
      expect(firstResult.results).toHaveLength(2);

      await addBusinessTypeToExcludeList('restaurant', testUserId, 'Hide from cached replay');

      const cachedReplayResult = await service.search(
        {
          location: 'TEST_Cache_Filter_Location',
          radius: 5000,
        },
        testUserId
      );

      expect(cachedReplayResult.fromCache).toBe(false);
      expect(cachedReplayResult.results).toHaveLength(0);
    });
  });
});
