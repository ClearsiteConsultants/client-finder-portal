import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const business = await prisma.business.findUnique({
      where: { id },
      include: {
        approvedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        rejectedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    return NextResponse.json(business);
  } catch (error) {
    console.error('Error fetching business:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { notes, nextFollowupAt } = body;

    const updateData: {
      notes?: string | null;
      nextFollowupAt?: Date | null;
    } = {};

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    if (nextFollowupAt !== undefined) {
      updateData.nextFollowupAt = nextFollowupAt ? new Date(nextFollowupAt) : null;
    }

    const business = await prisma.business.update({
      where: { id },
      data: updateData,
      include: {
        approvedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        rejectedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(business);
  } catch (error) {
    console.error('Error updating business:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
