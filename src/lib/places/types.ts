/**
 * Types for Google Places API integration
 */

export interface SearchRequest {
  location: string; // City/ZIP or "lat,lng"
  radius: number; // In meters
  businessType?: string; // Optional business type filter
}

export interface SearchResponse {
  results: BusinessResult[];
  nextPageToken?: string;
  status: 'success' | 'error';
  error?: string;
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
}

export interface GooglePlaceResult {
  place_id: string;
  name: string;
  formatted_address?: string;
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

export interface PlacesApiError {
  code: 'QUOTA_EXCEEDED' | 'INVALID_KEY' | 'NETWORK_ERROR' | 'INVALID_REQUEST' | 'UNKNOWN';
  message: string;
  originalError?: unknown;
}
