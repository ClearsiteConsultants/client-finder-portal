/**
 * Types for Google Places API integration
 */

export interface SearchRequest {
  location: string; // City/ZIP or "lat,lng"
  radius: number; // In meters
  businessType?: string; // Optional business type filter
  maxBusinesses?: number; // Max number of businesses to process per search
}

export interface SearchMetrics {
  geocodeCalls: number;
  nearbySearchCalls: number;
  placeDetailsCalls: number;
  placeDetailsFailures: number;
  detailsCandidates: number;
  detailsSelected: number;
  totalGooglePlacesCalls: number;
}

export interface SearchResponse {
  results: BusinessResult[];
  nextPageToken?: string;
  reachedEndOfResults?: boolean;
  status: 'success' | 'error';
  error?: string;
  fromCache?: boolean; // Whether results came from cache
  cacheAge?: number; // Age of cache in milliseconds
  metrics?: SearchMetrics; // Google Places API call metrics for this request
}

export interface BusinessResult {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone?: string;
  website?: string;
  businessTypes: string[];
  rating?: number;
  reviewCount?: number;
  hasWebsite: boolean;
  isNew: boolean; // Whether this was newly created in DB
  isCached?: boolean; // Whether this came from cache
}

export interface GooglePlaceResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  vicinity?: string;
  geometry?: {
    location: {
      lat: number;
      lng: number;
    };
  };
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  types?: string[];
  rating?: number;
  user_ratings_total?: number;
}

export interface NearbySearchResponse {
  results: GooglePlaceResult[];
  nextPageToken?: string;
}

export interface PlacesApiError {
  code: 'QUOTA_EXCEEDED' | 'INVALID_KEY' | 'NETWORK_ERROR' | 'INVALID_REQUEST' | 'UNKNOWN';
  message: string;
  originalError?: unknown;
}
