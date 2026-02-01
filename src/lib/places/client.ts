/**
 * Google Places API client wrapper
 */

import { Client } from '@googlemaps/google-maps-services-js';
import type { GooglePlaceResult, PlacesApiError } from './types';

export class PlacesClient {
  private client: Client;
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GOOGLE_MAPS_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('GOOGLE_MAPS_API_KEY is not configured');
    }
    this.client = new Client({});
  }

  /**
   * Search for places using Nearby Search
   */
  async nearbySearch(
    location: { lat: number; lng: number },
    radius: number,
    type?: string
  ): Promise<GooglePlaceResult[]> {
    try {
      const response = await this.client.placesNearby({
        params: {
          location,
          radius,
          type,
          key: this.apiKey,
        },
      });

      if (response.data.status === 'OK' || response.data.status === 'ZERO_RESULTS') {
        return (response.data.results || []) as GooglePlaceResult[];
      }

      throw this.createError(response.data.status, response.data.error_message);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error) {
        throw error as PlacesApiError;
      }
      throw this.createError('NETWORK_ERROR', String(error), error);
    }
  }

  /**
   * Get place details for a specific place ID
   */
  async getPlaceDetails(placeId: string): Promise<GooglePlaceResult> {
    try {
      const response = await this.client.placeDetails({
        params: {
          place_id: placeId,
          fields: [
            'place_id',
            'name',
            'formatted_address',
            'geometry',
            'formatted_phone_number',
            'international_phone_number',
            'website',
            'types',
            'rating',
            'user_ratings_total',
          ],
          key: this.apiKey,
        },
      });

      if (response.data.status === 'OK') {
        return response.data.result as GooglePlaceResult;
      }

      throw this.createError(response.data.status, response.data.error_message);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error) {
        throw error as PlacesApiError;
      }
      throw this.createError('NETWORK_ERROR', String(error), error);
    }
  }

  /**
   * Geocode a location string (city, ZIP) to lat/lng
   */
  async geocode(location: string): Promise<{ lat: number; lng: number }> {
    try {
      const response = await this.client.geocode({
        params: {
          address: location,
          key: this.apiKey,
        },
      });

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        const { lat, lng } = response.data.results[0].geometry.location;
        return { lat, lng };
      }

      throw this.createError('INVALID_REQUEST', `Could not geocode location: ${location}`);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error) {
        throw error as PlacesApiError;
      }
      throw this.createError('NETWORK_ERROR', String(error), error);
    }
  }

  private createError(status: string, message?: string, originalError?: unknown): PlacesApiError {
    let code: PlacesApiError['code'] = 'UNKNOWN';
    let errorMessage = message || 'Unknown error occurred';

    switch (status) {
      case 'OVER_QUERY_LIMIT':
      case 'OVER_DAILY_LIMIT':
        code = 'QUOTA_EXCEEDED';
        errorMessage = 'Google Places API quota exceeded. Please try again later or increase your quota.';
        break;
      case 'REQUEST_DENIED':
        code = 'INVALID_KEY';
        errorMessage = 'Google Places API key is invalid or not authorized for this request.';
        break;
      case 'INVALID_REQUEST':
        code = 'INVALID_REQUEST';
        errorMessage = message || 'Invalid request parameters.';
        break;
      case 'NETWORK_ERROR':
        code = 'NETWORK_ERROR';
        errorMessage = message || 'Network error occurred while contacting Google Places API.';
        break;
    }

    return { code, message: errorMessage, originalError };
  }
}
