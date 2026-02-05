import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { businessId, placeId } = body;

    if (!businessId || !placeId) {
      return NextResponse.json(
        { error: 'businessId and placeId are required' },
        { status: 400 }
      );
    }

    // Check if place_id is already used by another business
    const existingBusiness = await prisma.business.findUnique({
      where: { placeId },
    });

    if (existingBusiness && existingBusiness.id !== businessId) {
      return NextResponse.json(
        { error: 'This place_id is already linked to another business' },
        { status: 409 }
      );
    }

    // Update the business with the place_id
    const business = await prisma.business.update({
      where: { id: businessId },
      data: {
        placeId,
        source: 'google_maps', // Update source since it's now linked to Google
      },
    });

    return NextResponse.json({ success: true, business });
  } catch (error) {
    console.error('Error linking place_id:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
