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
    const { name, address, phone, website, email, instagram, facebook, twitter } = body;

    if (!name || !address) {
      return NextResponse.json(
        { error: 'Name and address are required' },
        { status: 400 }
      );
    }

    // Create the business with manual source and contact info
    const business = await prisma.business.create({
      data: {
        name: name.trim(),
        address: address.trim(),
        phone: phone?.trim() || null,
        website: website?.trim() || null,
        businessTypes: [],
        source: 'manual',
        leadStatus: 'pending',
        websiteStatus: 'unknown',
        contactInfo: email || instagram || facebook ? {
          create: {
            email: email?.trim() || null,
            facebookUrl: facebook?.trim() || null,
            instagramUrl: instagram?.trim() || null,
          },
        } : undefined,
      },
    });

    return NextResponse.json({ success: true, business }, { status: 201 });
  } catch (error) {
    console.error('Error creating manual lead:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
