/**
 * API endpoints for managing excluded businesses
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getExcludedBusinesses,
  addBusinessToExcludeList,
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
 * Add a business to the exclude list
 * Body: { businessName: string, reason?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { businessName, reason } = body;

    if (!businessName || typeof businessName !== 'string') {
      return NextResponse.json(
        { error: 'businessName is required and must be a string' },
        { status: 400 }
      );
    }

    if (businessName.trim().length === 0) {
      return NextResponse.json(
        { error: 'businessName cannot be empty' },
        { status: 400 }
      );
    }

    const excludedBusinessId = await addBusinessToExcludeList(
      businessName.trim(),
      session.user.id,
      reason?.trim() || undefined
    );

    return NextResponse.json(
      { id: excludedBusinessId, message: 'Business added to exclude list' },
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
