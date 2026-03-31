import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { JobProcessor } from '@/lib/jobs/processor';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const business = await prisma.business.findUnique({
    where: { id },
    select: { id: true, website: true },
  });

  if (!business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  }

  if (!business.website) {
    return NextResponse.json(
      { error: 'Lead has no website to scrape' },
      { status: 400 }
    );
  }

  const processor = new JobProcessor();

  // Run website validation first so websiteStatus reflects the current state.
  await processor.processJob(id, 'website_validation');

  // Run email scraping directly for this lead (status check inside processor).
  await processor.processJob(id, 'email_scraping');

  // Return full updated business (same shape as GET /api/leads/[id]).
  const updated = await prisma.business.findUnique({
    where: { id },
    include: {
      convertedByUser: { select: { id: true, name: true, email: true } },
      approvedByUser: { select: { id: true, name: true, email: true } },
      rejectedByUser: { select: { id: true, name: true, email: true } },
      contactInfo: {
        select: {
          id: true,
          email: true,
          phone: true,
          facebookUrl: true,
          instagramUrl: true,
          linkedinUrl: true,
        },
      },
    },
  });

  return NextResponse.json(updated);
}
