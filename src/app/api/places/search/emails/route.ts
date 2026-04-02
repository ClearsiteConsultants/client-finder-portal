import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type EmailLookupRequest = {
  placeIds?: string[];
};

function getWebsiteDomain(website: string | null | undefined): string | null {
  if (!website) {
    return null;
  }

  try {
    const hostname = new URL(website).hostname.toLowerCase();
    return hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function pickPreferredEmail(
  website: string | null,
  emails: string[]
): string | undefined {
  if (emails.length === 0) {
    return undefined;
  }

  const websiteDomain = getWebsiteDomain(website);
  if (!websiteDomain) {
    return emails[0];
  }

  const sameDomainEmail = emails.find((email) => {
    const emailDomain = email.split('@')[1]?.toLowerCase();
    return emailDomain === websiteDomain;
  });

  return sameDomainEmail || emails[0];
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as EmailLookupRequest;
  const requestedPlaceIds = Array.isArray(body.placeIds)
    ? body.placeIds.map((value) => value.trim()).filter((value) => value.length > 0)
    : [];

  if (requestedPlaceIds.length === 0) {
    return NextResponse.json({ emailsByPlaceId: {} });
  }

  const uniquePlaceIds = Array.from(new Set(requestedPlaceIds)).slice(0, 50);

  const businesses = await prisma.business.findMany({
    where: {
      placeId: {
        in: uniquePlaceIds,
      },
    },
    select: {
      placeId: true,
      website: true,
      contactInfo: {
        select: {
          email: true,
        },
      },
    },
  });

  const emailsByPlaceId = businesses.reduce<Record<string, string>>((acc, business) => {
    if (!business.placeId) {
      return acc;
    }

    const emails = business.contactInfo
      .map((contact) => contact.email?.trim().toLowerCase())
      .filter((email): email is string => !!email);

    const preferredEmail = pickPreferredEmail(business.website, emails);
    if (preferredEmail) {
      acc[business.placeId] = preferredEmail;
    }

    return acc;
  }, {});

  return NextResponse.json({ emailsByPlaceId });
}
