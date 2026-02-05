import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { assertValidTransition, InvalidStateTransitionError } from '@/lib/lead-lifecycle';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { businessIds, reason } = body;

    if (!Array.isArray(businessIds) || businessIds.length === 0) {
      return NextResponse.json({ error: 'businessIds array is required' }, { status: 400 });
    }

    // Validate state transitions
    const businesses = await prisma.business.findMany({
      where: { id: { in: businessIds } },
      select: { id: true, leadStatus: true, name: true },
    });

    const invalidTransitions = businesses.filter((business) => {
      try {
        assertValidTransition(business.leadStatus, 'rejected');
        return false;
      } catch (error) {
        return error instanceof InvalidStateTransitionError;
      }
    });

    if (invalidTransitions.length > 0) {
      return NextResponse.json({
        error: 'Invalid state transitions',
        details: invalidTransitions.map((b) => ({
          id: b.id,
          name: b.name,
          currentStatus: b.leadStatus,
          message: `Cannot reject lead in ${b.leadStatus} state`,
        })),
      }, { status: 400 });
    }

    const result = await prisma.business.updateMany({
      where: {
        id: { in: businessIds },
      },
      data: {
        leadStatus: 'rejected',
        rejectedAt: new Date(),
        rejectedByUserId: user.id,
        rejectedReason: reason || null,
      },
    });

    return NextResponse.json({
      success: true,
      count: result.count,
    });
  } catch (error) {
    console.error('Error rejecting leads:', error);
    return NextResponse.json(
      { error: 'Failed to reject leads' },
      { status: 500 }
    );
  }
}
