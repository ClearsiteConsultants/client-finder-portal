/**
 * POST /api/leads/convert-to-client
 * Converts an approved lead to a client
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { assertCanConvertToClient } from '@/lib/lead-lifecycle';
import { z } from 'zod';

const ConvertToClientSchema = z.object({
  businessId: z.string().uuid(),
  clientStatus: z.string().optional(),
  subscriptionStatus: z.string().optional(),
  initialPaymentStatus: z.string().optional(),
  nextPaymentDueDate: z.string().datetime().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = ConvertToClientSchema.parse(body);

    // Fetch the business
    const business = await prisma.business.findUnique({
      where: { id: validatedData.businessId },
      select: {
        id: true,
        leadStatus: true,
        isClient: true,
        name: true,
      },
    });

    if (!business) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    // Validate conversion eligibility
    assertCanConvertToClient(business);

    // Perform the conversion
    const updatedBusiness = await prisma.business.update({
      where: { id: business.id },
      data: {
        isClient: true,
        convertedAt: new Date(),
        convertedByUserId: session.user.id,
        clientStatus: validatedData.clientStatus,
        subscriptionStatus: validatedData.subscriptionStatus,
        initialPaymentStatus: validatedData.initialPaymentStatus,
        nextPaymentDueDate: validatedData.nextPaymentDueDate 
          ? new Date(validatedData.nextPaymentDueDate) 
          : undefined,
      },
      include: {
        convertedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      business: updatedBusiness,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      if (error.name === 'InvalidConversionError') {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }

      console.error('Error converting lead to client:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Unknown error occurred' },
      { status: 500 }
    );
  }
}
