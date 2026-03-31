/**
 * API endpoint for searching businesses via Google Places API
 * POST /api/places/search
 */

import { NextRequest, NextResponse } from 'next/server';
import { PlacesService } from '@/lib/places/service';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { SearchRequest } from '@/lib/places/types';
import { checkBusinessTypeExclusion } from '@/lib/scoring/exclusions';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Guard against stale JWTs that reference a deleted user record.
    const authUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true },
    });

    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized: session is no longer valid. Please sign in again.' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: SearchRequest = await request.json();
    const searchBy = body.searchBy || 'location';

    if (searchBy !== 'location' && searchBy !== 'business_name') {
      return NextResponse.json(
        { error: 'searchBy must be either "location" or "business_name"' },
        { status: 400 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl?.searchParams ?? new URL(request.url).searchParams;
    const forceRefresh = searchParams.get('force_refresh') === 'true';

    // Validate required fields
    if (searchBy === 'business_name') {
      if (!body.businessName || !body.businessName.trim()) {
        return NextResponse.json(
          { error: 'Business name is required' },
          { status: 400 }
        );
      }

      if (!body.location || !body.location.trim()) {
        return NextResponse.json(
          { error: 'Location is required for business name searches' },
          { status: 400 }
        );
      }
    } else if (!body.location || !body.location.trim()) {
      return NextResponse.json(
        { error: 'Location is required' },
        { status: 400 }
      );
    }

    if (!body.radius || body.radius <= 0) {
      return NextResponse.json(
        { error: 'Valid radius is required' },
        { status: 400 }
      );
    }

    // Validate radius is within reasonable limits (Google Places allows up to 50,000m)
    if (body.radius > 50000) {
      return NextResponse.json(
        { error: 'Radius must be 50,000 meters or less' },
        { status: 400 }
      );
    }

    if (body.maxBusinesses !== undefined) {
      if (!Number.isInteger(body.maxBusinesses) || body.maxBusinesses < 1 || body.maxBusinesses > 20) {
        return NextResponse.json(
          { error: 'maxBusinesses must be an integer between 1 and 20' },
          { status: 400 }
        );
      }
    }

    if (body.businessType) {
      const exclusion = await checkBusinessTypeExclusion([body.businessType]);
      if (exclusion.isExcluded) {
        return NextResponse.json(
          {
            error: `Business type "${body.businessType}" is excluded and cannot be searched.`,
            status: 'error',
          },
          { status: 400 }
        );
      }
    }

    // Create service and execute search
    const service = new PlacesService();
    const response = await service.search(body, authUser.id, { forceRefresh });

    if (response.status === 'error') {
      // Return appropriate status code based on error type
      let statusCode = 500;
      const errorMessage = response.error || 'Unknown error';

      if (errorMessage.includes('quota') || errorMessage.includes('QUOTA')) {
        statusCode = 429; // Too Many Requests
      } else if (errorMessage.includes('invalid') || errorMessage.includes('INVALID')) {
        statusCode = 400; // Bad Request
      } else if (errorMessage.includes('denied') || errorMessage.includes('DENIED')) {
        statusCode = 403; // Forbidden
      }

      return NextResponse.json(
        {
          error: errorMessage,
          status: 'error',
        },
        { status: statusCode }
      );
    }

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error in places search API:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
        status: 'error',
      },
      { status: 500 }
    );
  }
}
