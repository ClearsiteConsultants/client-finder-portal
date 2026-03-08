/**
 * API endpoints for managing excluded businesses
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getExcludedBusinesses,
  addBusinessToExcludeList,
  addBusinessTypeToExcludeList,
  removeBusinessFromExcludeList,
} from '@/lib/scoring/exclusions';

/**
 * GET /api/exclusions
 * Retrieve all excluded businesses
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const excluded = await getExcludedBusinesses();
    return NextResponse.json({ excluded });
  } catch (error) {
    console.error('Error fetching excluded businesses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch excluded businesses' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/exclusions
 * Add an exclusion entry
 * Body: { businessName?: string, businessType?: string, reason?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { businessName, businessType, reason } = body;
    const hasBusinessName = typeof businessName === 'string' && businessName.trim().length > 0;
    const hasBusinessType = typeof businessType === 'string' && businessType.trim().length > 0;

    if (!hasBusinessName && !hasBusinessType) {
      return NextResponse.json(
        { error: 'Either businessName or businessType is required' },
        { status: 400 }
      );
    }

    if (hasBusinessName && hasBusinessType) {
      return NextResponse.json(
        { error: 'Provide only one of businessName or businessType' },
        { status: 400 }
      );
    }

    const excludedBusinessId = hasBusinessType
      ? await addBusinessTypeToExcludeList(
          businessType.trim(),
          session.user.id,
          reason?.trim() || undefined
        )
      : await addBusinessToExcludeList(
          businessName.trim(),
          session.user.id,
          reason?.trim() || undefined
        );

    return NextResponse.json(
      { id: excludedBusinessId, message: 'Entry added to exclude list' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error adding business to exclude list:', error);
    return NextResponse.json(
      { error: 'Failed to add business to exclude list' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/exclusions
 * Remove a business from the exclude list
 * Body: { excludedBusinessId: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { excludedBusinessId } = body;

    if (!excludedBusinessId || typeof excludedBusinessId !== 'string') {
      return NextResponse.json(
        { error: 'excludedBusinessId is required and must be a string' },
        { status: 400 }
      );
    }

    await removeBusinessFromExcludeList(excludedBusinessId);

    return NextResponse.json({ message: 'Business removed from exclude list' });
  } catch (error) {
    console.error('Error removing business from exclude list:', error);
    return NextResponse.json(
      { error: 'Failed to remove business from exclude list' },
      { status: 500 }
    );
  }
}
