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
    const { name, address } = body;

    if (!name || !address) {
      return NextResponse.json({ error: 'Name and address are required' }, { status: 400 });
    }

    // Normalize for comparison
    const normalizedName = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedAddress = address.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

    // Find potential duplicates
    const businesses = await prisma.business.findMany({
      select: {
        id: true,
        name: true,
        address: true,
        placeId: true,
      },
    });

    // Check for duplicates with same normalized name and address
    const duplicate = businesses.find((b) => {
      const bName = b.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const bAddress = b.address.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      return bName === normalizedName && bAddress === normalizedAddress;
    });

    if (duplicate) {
      return NextResponse.json({
        duplicate: {
          id: duplicate.id,
          name: duplicate.name,
          address: duplicate.address,
          placeId: duplicate.placeId,
        },
      });
    }

    return NextResponse.json({ duplicate: null });
  } catch (error) {
    console.error('Error checking duplicate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
