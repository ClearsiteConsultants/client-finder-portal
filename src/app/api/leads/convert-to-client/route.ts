/**
 * POST /api/leads/convert-to-client
 * Converts an approved lead to a client
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
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
    
    if (!session?.user?.email && !session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const actingUser = session.user.email
      ? await prisma.user.findUnique({
          where: { email: session.user.email },
          select: { id: true },
        })
      : await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { id: true },
        });

    if (!actingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
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

    // Perform conversion atomically to prevent stale-status conversions.
    const conversionResult = await prisma.business.updateMany({
      where: {
        id: business.id,
        leadStatus: 'approved',
        isClient: false,
      },
      data: {
        isClient: true,
        convertedAt: new Date(),
        convertedByUserId: actingUser.id,
        clientStatus: validatedData.clientStatus ?? 'active',
        subscriptionStatus: validatedData.subscriptionStatus,
        initialPaymentStatus: validatedData.initialPaymentStatus,
        nextPaymentDueDate: validatedData.nextPaymentDueDate
          ? new Date(validatedData.nextPaymentDueDate)
          : undefined,
      },
    });

    if (conversionResult.count === 0) {
      return NextResponse.json(
        { error: 'Only approved leads can be converted to an active client' },
        { status: 400 }
      );
    }

    const updatedBusiness = await prisma.business.findUnique({
      where: { id: business.id },
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

    if (!updatedBusiness) {
      return NextResponse.json(
        { error: 'Business not found after conversion' },
        { status: 404 }
      );
    }

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
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return NextResponse.json(
          { error: 'Failed to convert lead due to data constraint violation' },
          { status: 400 }
        );
      }
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
