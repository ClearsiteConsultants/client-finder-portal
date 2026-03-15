import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { mergeBusinessTypes } from '@/lib/places/business-types';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const businesses = await prisma.business.findMany({
      select: { businessTypes: true },
      where: {
        businessTypes: {
          isEmpty: false,
        },
      },
    });

    const discoveredTypes = businesses.flatMap((business) => business.businessTypes);
    const businessTypes = mergeBusinessTypes(discoveredTypes);

    return NextResponse.json({ businessTypes });
  } catch (error) {
    console.error('Error fetching business types:', error);
    return NextResponse.json({ error: 'Failed to fetch business types' }, { status: 500 });
  }
}
