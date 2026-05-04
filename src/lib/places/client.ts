/**
 * Google Places API client wrapper
 */

import { Client } from '@googlemaps/google-maps-services-js';
import type { GooglePlaceResult, NearbySearchResponse, PlacesApiError } from './types';

export class PlacesClient {
  private client: Client;
  private apiKey: string;

  private toReadableErrorMessage(error: unknown, fallback = 'Unknown error occurred'): string {
    if (typeof error === 'string' && error.trim().length > 0) {
      return error;
    }

    if (error instanceof Error && typeof error.message === 'string' && error.message.trim().length > 0) {
      return error.message;
    }

    if (error && typeof error === 'object') {
      const candidateFields = [
        'error',
        'error_message',
        'message',
        'detail',
        'details',
        'reason',
        'statusText',
      ] as const;

      for (const field of candidateFields) {
        if (!(field in error)) {
          continue;
        }

        const fieldValue = (error as Record<string, unknown>)[field];
        if (typeof fieldValue === 'string' && fieldValue.trim().length > 0) {
          return fieldValue;
        }

        if (fieldValue && typeof fieldValue === 'object') {
          try {
            const serializedField = JSON.stringify(fieldValue);
            if (serializedField && serializedField !== '{}') {
              return serializedField;
            }
          } catch {
            // Ignore and continue.
          }
        }
      }

      try {
        const serializedError = JSON.stringify(error);
        if (serializedError && serializedError !== '{}') {
          return serializedError;
        }
      } catch {
        // Ignore and return fallback below.
      }
    }

    return fallback;
  }

  private isPlacesApiError(error: unknown): error is PlacesApiError {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const code = (error as { code?: unknown }).code;
    return (
      code === 'QUOTA_EXCEEDED' ||
      code === 'INVALID_KEY' ||
      code === 'NETWORK_ERROR' ||
      code === 'INVALID_REQUEST' ||
      code === 'UNKNOWN'
    );
  }

  private parseGoogleHttpError(error: unknown): PlacesApiError | null {
    if (!error || typeof error !== 'object') {
      return null;
    }

    const errorWithResponse = error as {
      message?: string;
      response?: {
        status?: number;
        data?: {
          status?: string;
          error_message?: string;
        };
      };
    };

    const httpStatus = errorWithResponse.response?.status;
    const googleStatus = errorWithResponse.response?.data?.status;
    const googleErrorMessage = errorWithResponse.response?.data?.error_message;
    const fallbackMessage =
      typeof errorWithResponse.message === 'string' && errorWithResponse.message.trim().length > 0
        ? errorWithResponse.message
        : undefined;

    if (googleStatus === 'REQUEST_DENIED' || httpStatus === 403) {
      return this.createError('REQUEST_DENIED', googleErrorMessage || fallbackMessage, error);
    }

    if (googleStatus === 'OVER_QUERY_LIMIT' || googleStatus === 'OVER_DAILY_LIMIT' || httpStatus === 429) {
      return this.createError('OVER_QUERY_LIMIT', googleErrorMessage || fallbackMessage, error);
    }

    if (googleStatus === 'INVALID_REQUEST' || httpStatus === 400) {
      return this.createError('INVALID_REQUEST', googleErrorMessage || fallbackMessage, error);
    }

    if (typeof httpStatus === 'number' && httpStatus >= 500) {
      return this.createError('NETWORK_ERROR', googleErrorMessage || fallbackMessage, error);
    }

    return null;
  }

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
    type?: string,
    keyword?: string,
    pageToken?: string
  ): Promise<NearbySearchResponse> {
    try {
      const response = await this.client.placesNearby({
        params: {
          location,
          radius,
          ...(type ? { type } : {}),
          ...(keyword ? { keyword } : {}),
          ...(pageToken ? { pagetoken: pageToken } : {}),
          key: this.apiKey,
        },
      });

      if (response.data.status === 'OK' || response.data.status === 'ZERO_RESULTS') {
        return {
          results: (response.data.results || []) as GooglePlaceResult[],
          nextPageToken: response.data.next_page_token,
        };
      }

      throw this.createError(response.data.status, response.data.error_message);
    } catch (error) {
      if (this.isPlacesApiError(error)) {
        throw error;
      }
      const parsedHttpError = this.parseGoogleHttpError(error);
      if (parsedHttpError) {
        throw parsedHttpError;
      }
      throw this.createError('NETWORK_ERROR', this.toReadableErrorMessage(error), error);
    }
  }

  /**
   * Search for places by free-text query (for business name mode)
   */
  async textSearch(
    query: string,
    type?: string,
    locationBias?: { lat: number; lng: number },
    radiusBias?: number,
    pageToken?: string
  ): Promise<NearbySearchResponse> {
    try {
      const effectiveQuery = type ? `${query} ${type}` : query;

      const response = await this.client.textSearch({
        params: {
          query: effectiveQuery,
          ...(locationBias ? { location: locationBias } : {}),
          ...(radiusBias ? { radius: radiusBias } : {}),
          ...(pageToken ? { pagetoken: pageToken } : {}),
          key: this.apiKey,
        },
      });

      if (response.data.status === 'OK' || response.data.status === 'ZERO_RESULTS') {
        return {
          results: (response.data.results || []) as GooglePlaceResult[],
          nextPageToken: response.data.next_page_token,
        };
      }

      throw this.createError(response.data.status, response.data.error_message);
    } catch (error) {
      if (this.isPlacesApiError(error)) {
        throw error;
      }
      const parsedHttpError = this.parseGoogleHttpError(error);
      if (parsedHttpError) {
        throw parsedHttpError;
      }
      throw this.createError('NETWORK_ERROR', this.toReadableErrorMessage(error), error);
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
      if (this.isPlacesApiError(error)) {
        throw error;
      }
      const parsedHttpError = this.parseGoogleHttpError(error);
      if (parsedHttpError) {
        throw parsedHttpError;
      }
      throw this.createError('NETWORK_ERROR', this.toReadableErrorMessage(error), error);
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
      if (this.isPlacesApiError(error)) {
        throw error;
      }
      const parsedHttpError = this.parseGoogleHttpError(error);
      if (parsedHttpError) {
        throw parsedHttpError;
      }
      throw this.createError('NETWORK_ERROR', this.toReadableErrorMessage(error), error);
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
        if (!message) {
          errorMessage = 'Google Maps API key is invalid or not authorized for this request.';
          break;
        }

        {
          const normalizedMessage = message.toLowerCase();

          if (
            normalizedMessage.includes('billing') ||
            normalizedMessage.includes('payment') ||
            normalizedMessage.includes('trial')
          ) {
            errorMessage =
              'Google Maps API billing is not active for this project (your free trial may have ended). Enable billing in Google Cloud and retry.';
          } else if (normalizedMessage.includes('not activated') || normalizedMessage.includes('api is not activated')) {
            errorMessage =
              'Google Maps API access is denied because required setup is incomplete. Billing may not be active and/or Places API and Geocoding API are not enabled. Enable billing and both APIs in Google Cloud and retry.';
          } else if (
            normalizedMessage.includes('not authorized') ||
            normalizedMessage.includes('referer') ||
            normalizedMessage.includes('ip')
          ) {
            errorMessage =
              'Google Maps API key restrictions are blocking this request. Verify API key restrictions for server-side calls.';
          } else {
            errorMessage = `Google Maps API request denied: ${message}`;
          }
        }
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
