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
    const { businessId, reason } = body;

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, leadStatus: true, name: true },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Validate state transition
    try {
      assertValidTransition(business.leadStatus, 'inactive');
    } catch (error) {
      if (error instanceof InvalidStateTransitionError) {
        return NextResponse.json({
          error: 'Invalid state transition',
          currentStatus: business.leadStatus,
          message: `Cannot mark lead as inactive from ${business.leadStatus} state`,
        }, { status: 400 });
      }
      throw error;
    }

    const updated = await prisma.business.update({
      where: { id: businessId },
      data: {
        leadStatus: 'inactive',
        notes: reason ? `Marked inactive: ${reason}\nDate: ${new Date().toISOString()}` : `Marked inactive at ${new Date().toISOString()}`,
      },
    });

    return NextResponse.json({
      success: true,
      business: {
        id: updated.id,
        name: updated.name,
        leadStatus: updated.leadStatus,
      },
    });
  } catch (error) {
    console.error('Error marking lead as inactive:', error);
    return NextResponse.json(
      { error: 'Failed to mark lead as inactive' },
      { status: 500 }
    );
  }
}
