import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { LeadStatus, WebsiteStatus, Business, ContactInfo } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);
    const sortBy = searchParams.get('sortBy') || 'priority';
    const sortOrder = searchParams.get('sortOrder') || 'asc';
    const statusFilter = searchParams.get('status') as LeadStatus | null;
    const websiteStatusFilter = searchParams.get('websiteStatus') as WebsiteStatus | null;

    const skip = (page - 1) * pageSize;

    const where: any = {};
    
    if (statusFilter) {
      where.leadStatus = statusFilter;
    } else {
      where.leadStatus = 'pending';
    }

    if (websiteStatusFilter) {
      where.websiteStatus = websiteStatusFilter;
    }

    let orderBy: any = {};
    
    if (sortBy === 'priority') {
      orderBy = [
        { websiteStatus: 'asc' },
        { discoveredAt: 'desc' },
      ];
    } else if (sortBy === 'name') {
      orderBy = { name: sortOrder };
    } else if (sortBy === 'score') {
      orderBy = { smallBusinessScore: sortOrder === 'asc' ? 'asc' : 'desc' };
    } else if (sortBy === 'discoveredAt') {
      orderBy = { discoveredAt: sortOrder };
    }

    const [leads, total] = await Promise.all([
      prisma.business.findMany({
        where,
        include: {
          contactInfo: true,
        },
        orderBy,
        skip,
        take: pageSize,
      }),
      prisma.business.count({ where }),
    ]);

    const leadsWithIndicators = leads.map((lead: Business & { contactInfo: ContactInfo[] }) => {
      const hasEmail = lead.contactInfo.some((c: ContactInfo) => c.email);
      const hasPhone = !!lead.phone || lead.contactInfo.some((c: ContactInfo) => c.phone);
      const hasSocial = lead.contactInfo.some(
        (c: ContactInfo) => c.facebookUrl || c.instagramUrl || c.linkedinUrl
      );

      return {
        id: lead.id,
        placeId: lead.placeId,
        name: lead.name,
        address: lead.address,
        phone: lead.phone,
        website: lead.website,
        websiteStatus: lead.websiteStatus,
        leadStatus: lead.leadStatus,
        smallBusinessScore: lead.smallBusinessScore,
        discoveredAt: lead.discoveredAt,
        hasEmail,
        hasPhone,
        hasSocial,
        rating: lead.rating,
        reviewCount: lead.reviewCount,
      };
    });

    return NextResponse.json({
      leads: leadsWithIndicators,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('Error fetching review queue:', error);
    return NextResponse.json(
      { error: 'Failed to fetch review queue' },
      { status: 500 }
    );
  }
}
