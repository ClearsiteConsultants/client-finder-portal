/**
 * Tests for Google Places normalizer
 */

import { normalizeGooglePlace, normalizeGooglePlaces, toPrismaCreateInput } from './normalizer';
import type { GooglePlaceResult } from './types';

describe('normalizeGooglePlace', () => {
  it('normalizes a complete Google Place result', () => {
    const googlePlace: GooglePlaceResult = {
      place_id: 'ChIJ123456789',
      name: 'Test Business',
      formatted_address: '123 Main St, City, ST 12345',
      geometry: {
        location: {
          lat: 40.7128,
          lng: -74.0060,
        },
      },
      formatted_phone_number: '(123) 456-7890',
      website: 'https://testbusiness.com',
      types: ['restaurant', 'food', 'establishment'],
      rating: 4.5,
      user_ratings_total: 100,
    };

    const normalized = normalizeGooglePlace(googlePlace);

    expect(normalized).toEqual({
      placeId: 'ChIJ123456789',
      name: 'Test Business',
      address: '123 Main St, City, ST 12345',
      lat: 40.7128,
      lng: -74.0060,
      phone: '(123) 456-7890',
      website: 'https://testbusiness.com',
      businessTypes: ['restaurant', 'food', 'establishment'],
      rating: 4.5,
      reviewCount: 100,
      source: 'google_maps',
      websiteStatus: 'unknown',
    });
  });

  it('handles missing optional fields', () => {
    const googlePlace: GooglePlaceResult = {
      place_id: 'ChIJ987654321',
      name: 'Minimal Business',
      formatted_address: '456 Oak Ave',
    };

    const normalized = normalizeGooglePlace(googlePlace);

    expect(normalized).toEqual({
      placeId: 'ChIJ987654321',
      name: 'Minimal Business',
      address: '456 Oak Ave',
      lat: null,
      lng: null,
      phone: null,
      website: null,
      businessTypes: [],
      rating: null,
      reviewCount: null,
      source: 'google_maps',
      websiteStatus: 'no_website',
    });
  });

  it('sets websiteStatus to no_website when no website present', () => {
    const googlePlace: GooglePlaceResult = {
      place_id: 'ChIJ111111111',
      name: 'No Website Business',
      formatted_address: '789 Elm St',
    };

    const normalized = normalizeGooglePlace(googlePlace);
    expect(normalized.websiteStatus).toBe('no_website');
  });

  it('sets websiteStatus to unknown when website is present', () => {
    const googlePlace: GooglePlaceResult = {
      place_id: 'ChIJ222222222',
      name: 'Has Website Business',
      formatted_address: '321 Pine St',
      website: 'https://example.com',
    };

    const normalized = normalizeGooglePlace(googlePlace);
    expect(normalized.websiteStatus).toBe('unknown');
  });

  it('prefers formatted_phone_number over international_phone_number', () => {
    const googlePlace: GooglePlaceResult = {
      place_id: 'ChIJ333333333',
      name: 'Phone Test',
      formatted_address: '111 Test St',
      formatted_phone_number: '(555) 123-4567',
      international_phone_number: '+1 555-123-4567',
    };

    const normalized = normalizeGooglePlace(googlePlace);
    expect(normalized.phone).toBe('(555) 123-4567');
  });

  it('falls back to international_phone_number when formatted not available', () => {
    const googlePlace: GooglePlaceResult = {
      place_id: 'ChIJ444444444',
      name: 'International Phone Test',
      formatted_address: '222 Test St',
      international_phone_number: '+1 555-987-6543',
    };

    const normalized = normalizeGooglePlace(googlePlace);
    expect(normalized.phone).toBe('+1 555-987-6543');
  });
});

describe('normalizeGooglePlaces', () => {
  it('normalizes an array of Google Place results', () => {
    const places: GooglePlaceResult[] = [
      {
        place_id: 'ChIJ1',
        name: 'Business 1',
        formatted_address: '100 First St',
        website: 'https://business1.com',
      },
      {
        place_id: 'ChIJ2',
        name: 'Business 2',
        formatted_address: '200 Second St',
      },
    ];

    const normalized = normalizeGooglePlaces(places);

    expect(normalized).toHaveLength(2);
    expect(normalized[0].placeId).toBe('ChIJ1');
    expect(normalized[0].websiteStatus).toBe('unknown');
    expect(normalized[1].placeId).toBe('ChIJ2');
    expect(normalized[1].websiteStatus).toBe('no_website');
  });

  it('handles empty array', () => {
    const normalized = normalizeGooglePlaces([]);
    expect(normalized).toEqual([]);
  });
});

describe('toPrismaCreateInput', () => {
  it('converts normalized business to Prisma create input', () => {
    const normalized = {
      placeId: 'ChIJ123',
      name: 'Test Business',
      address: '123 Main St',
      lat: 40.7128,
      lng: -74.0060,
      phone: '(123) 456-7890',
      website: 'https://test.com',
      businessTypes: ['restaurant'],
      rating: 4.5,
      reviewCount: 100,
      source: 'google_maps' as const,
      websiteStatus: 'unknown' as const,
    };

    const input = toPrismaCreateInput(normalized);

    expect(input).toEqual({
      placeId: 'ChIJ123',
      name: 'Test Business',
      address: '123 Main St',
      lat: 40.7128,
      lng: -74.0060,
      phone: '(123) 456-7890',
      website: 'https://test.com',
      businessTypes: ['restaurant'],
      rating: 4.5,
      reviewCount: 100,
      source: 'google_maps',
      websiteStatus: 'unknown',
      leadStatus: 'pending',
      sourceSearchRun: undefined,
    });
  });

  it('links to search run when provided', () => {
    const normalized = {
      placeId: 'ChIJ456',
      name: 'Test',
      address: '456 St',
      lat: null,
      lng: null,
      phone: null,
      website: null,
      businessTypes: [],
      rating: null,
      reviewCount: null,
      source: 'google_maps' as const,
      websiteStatus: 'no_website' as const,
    };

    const searchRunId = 'search-run-uuid';
    const input = toPrismaCreateInput(normalized, searchRunId);

    expect(input.sourceSearchRun).toEqual({ connect: { id: searchRunId } });
  });

  it('handles null lat/lng by converting to undefined', () => {
    const normalized = {
      placeId: 'ChIJ789',
      name: 'No Location',
      address: '789 St',
      lat: null,
      lng: null,
      phone: null,
      website: null,
      businessTypes: [],
      rating: null,
      reviewCount: null,
      source: 'google_maps' as const,
      websiteStatus: 'no_website' as const,
    };

    const input = toPrismaCreateInput(normalized);

    expect(input.lat).toBeUndefined();
    expect(input.lng).toBeUndefined();
  });
});
