/**
 * Normalizes Google Places API responses to our internal schema
 */

import type { GooglePlaceResult } from './types';
import type { Prisma } from '@prisma/client';

export interface NormalizedBusiness {
  placeId: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  website: string | null;
  businessTypes: string[];
  rating: number | null;
  reviewCount: number | null;
  source: 'google_maps';
  websiteStatus: 'no_website' | 'unknown';
}

/**
 * Normalizes a Google Place result to our Business model structure
 */
export function normalizeGooglePlace(place: GooglePlaceResult): NormalizedBusiness {
  const hasWebsite = !!place.website;
  
  return {
    placeId: place.place_id,
    name: place.name || 'Unknown Business',
    address: place.formatted_address || '',
    lat: place.geometry?.location?.lat ?? null,
    lng: place.geometry?.location?.lng ?? null,
    phone: place.formatted_phone_number || place.international_phone_number || null,
    website: place.website || null,
    businessTypes: place.types || [],
    rating: place.rating ?? null,
    reviewCount: place.user_ratings_total ?? null,
    source: 'google_maps',
    websiteStatus: hasWebsite ? 'unknown' : 'no_website',
  };
}

/**
 * Converts normalized business to Prisma create input
 */
export function toPrismaCreateInput(
  normalized: NormalizedBusiness,
  searchRunId?: string
): Prisma.BusinessCreateInput {
  return {
    placeId: normalized.placeId,
    name: normalized.name,
    address: normalized.address,
    lat: normalized.lat !== null ? normalized.lat : undefined,
    lng: normalized.lng !== null ? normalized.lng : undefined,
    phone: normalized.phone,
    website: normalized.website,
    businessTypes: normalized.businessTypes,
    rating: normalized.rating,
    reviewCount: normalized.reviewCount,
    source: normalized.source,
    websiteStatus: normalized.websiteStatus,
    leadStatus: 'pending',
    sourceSearchRun: searchRunId ? { connect: { id: searchRunId } } : undefined,
  };
}

/**
 * Batch normalizes multiple Google Place results
 */
export function normalizeGooglePlaces(places: GooglePlaceResult[]): NormalizedBusiness[] {
  return places.map(normalizeGooglePlace);
}
