import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { mergeBusinessTypes } from '@/lib/places/business-types';
import { getExcludedBusinessTypes } from '@/lib/scoring/exclusions';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const forSearch = url.searchParams.get('forSearch') === 'true';

    const businesses = await prisma.business.findMany({
      select: { businessTypes: true },
      where: {
        businessTypes: {
          isEmpty: false,
        },
      },
    });

    const discoveredTypes = businesses.flatMap((business) => business.businessTypes);
    let businessTypes = mergeBusinessTypes(discoveredTypes);

    if (forSearch) {
      const excludedBusinessTypes = await getExcludedBusinessTypes();
      const excludedSet = new Set(excludedBusinessTypes.map((type) => type.trim().toLowerCase()));
      businessTypes = businessTypes.filter((type) => !excludedSet.has(type.trim().toLowerCase()));
    }

    return NextResponse.json({ businessTypes });
  } catch (error) {
    console.error('Error fetching business types:', error);
    return NextResponse.json({ error: 'Failed to fetch business types' }, { status: 500 });
  }
}
