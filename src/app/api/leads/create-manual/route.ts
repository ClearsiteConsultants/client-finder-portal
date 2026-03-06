import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deriveWebsiteStatus } from '@/lib/validation/website-status';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, address, phone, website, email, instagram, facebook, linkedin } = body;

    if (!name || !address) {
      return NextResponse.json(
        { error: 'Name and address are required' },
        { status: 400 }
      );
    }

    const normalizedWebsite = website?.trim() || null;
    const normalizedFacebook = facebook?.trim() || null;
    const normalizedInstagram = instagram?.trim() || null;
    const normalizedLinkedin = linkedin?.trim() || null;

    const websiteStatus = await deriveWebsiteStatus({
      website: normalizedWebsite,
      socialProfiles: {
        facebookUrl: normalizedFacebook,
        instagramUrl: normalizedInstagram,
        linkedinUrl: normalizedLinkedin,
      },
    });

    // Create the business with manual source and contact info
    const business = await prisma.business.create({
      data: {
        name: name.trim(),
        address: address.trim(),
        phone: phone?.trim() || null,
        website: normalizedWebsite,
        businessTypes: [],
        source: 'manual',
        leadStatus: 'pending',
        websiteStatus,
        contactInfo: email || normalizedInstagram || normalizedFacebook || normalizedLinkedin ? {
          create: {
            email: email?.trim() || null,
            facebookUrl: normalizedFacebook,
            instagramUrl: normalizedInstagram,
            linkedinUrl: normalizedLinkedin,
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
