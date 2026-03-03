import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma, LeadStatus, BusinessSource } from '@prisma/client';

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
    const { 
      notes, 
      nextFollowupAt,
      address,
      phone,
      website,
      placeId,
      source,
      leadStatus,
      businessTypes,
      rating,
      facebookUrl,
      instagramUrl,
      linkedinUrl,
    } = body;

    const updateData: Prisma.BusinessUpdateInput = {};

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    if (nextFollowupAt !== undefined) {
      updateData.nextFollowupAt = nextFollowupAt ? new Date(nextFollowupAt) : null;
    }

    if (address !== undefined) {
      updateData.address = address.trim();
    }

    if (phone !== undefined) {
      updateData.phone = phone ? phone.trim() : null;
    }

    if (website !== undefined) {
      updateData.website = website ? website.trim() : null;
    }

    if (placeId !== undefined) {
      updateData.placeId = placeId ? placeId.trim() : null;
    }

    if (source !== undefined) {
      updateData.source = source as BusinessSource;
    }

    if (leadStatus !== undefined) {
      updateData.leadStatus = leadStatus as LeadStatus;
    }

    if (businessTypes !== undefined) {
      updateData.businessTypes = Array.isArray(businessTypes) 
        ? businessTypes.map((t: string) => t.trim()).filter((t: string) => t)
        : [];
    }

    if (rating !== undefined) {
      updateData.rating = rating !== null ? Number(rating) : null;
    }

    // Update business
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

    // Handle social media updates in ContactInfo
    if (facebookUrl !== undefined || instagramUrl !== undefined || linkedinUrl !== undefined) {
      const existingContact = await prisma.contactInfo.findFirst({
        where: { businessId: id },
      });

      if (existingContact) {
        // Update existing contact info
        const contactUpdateData: Prisma.ContactInfoUpdateInput = {};
        if (facebookUrl !== undefined) contactUpdateData.facebookUrl = facebookUrl;
        if (instagramUrl !== undefined) contactUpdateData.instagramUrl = instagramUrl;
        if (linkedinUrl !== undefined) contactUpdateData.linkedinUrl = linkedinUrl;

        await prisma.contactInfo.update({
          where: { id: existingContact.id },
          data: contactUpdateData,
        });
      } else if (facebookUrl || instagramUrl || linkedinUrl) {
        // Create new contact info if any social media link is provided
        await prisma.contactInfo.create({
          data: {
            businessId: id,
            facebookUrl: facebookUrl || null,
            instagramUrl: instagramUrl || null,
            linkedinUrl: linkedinUrl || null,
          },
        });
      }

      // Refetch business with updated contactInfo
      const updatedBusiness = await prisma.business.findUnique({
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
      
      return NextResponse.json(updatedBusiness);
    }

    return NextResponse.json(business);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Google Place ID is already linked to another business' },
        { status: 409 }
      );
    }

    console.error('Error updating business:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const existingBusiness = await prisma.business.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingBusiness) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    await prisma.business.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting business:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
