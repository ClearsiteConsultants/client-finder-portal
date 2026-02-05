/**
 * GET /api/clients/[id] - Get client details
 * PATCH /api/clients/[id] - Update client fields
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const UpdateClientSchema = z.object({
  clientStatus: z.string().optional(),
  subscriptionStatus: z.string().optional(),
  initialPaymentStatus: z.string().optional(),
  nextPaymentDueDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const client = await prisma.business.findUnique({
      where: { 
        id,
        isClient: true,
      },
      include: {
        convertedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        approvedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        contactInfo: true,
        outreachTracking: {
          orderBy: { occurredAt: 'desc' },
          take: 20,
          include: {
            createdByUser: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ client });
  } catch (error: unknown) {
    console.error('Error fetching client:', error);
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
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = UpdateClientSchema.parse(body);

    // Check if client exists
    const client = await prisma.business.findUnique({
      where: { 
        id,
        isClient: true,
      },
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    // Update client fields
    const updateData: any = {};

    if (validatedData.clientStatus !== undefined) {
      updateData.clientStatus = validatedData.clientStatus;
    }

    if (validatedData.subscriptionStatus !== undefined) {
      updateData.subscriptionStatus = validatedData.subscriptionStatus;
    }

    if (validatedData.initialPaymentStatus !== undefined) {
      updateData.initialPaymentStatus = validatedData.initialPaymentStatus;
    }

    if (validatedData.nextPaymentDueDate !== undefined) {
      updateData.nextPaymentDueDate = validatedData.nextPaymentDueDate 
        ? new Date(validatedData.nextPaymentDueDate)
        : null;
    }

    if (validatedData.notes !== undefined) {
      updateData.notes = validatedData.notes;
    }

    const updatedClient = await prisma.business.update({
      where: { id },
      data: updateData,
      include: {
        convertedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        contactInfo: true,
      },
    });

    return NextResponse.json({
      success: true,
      client: updatedClient,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error updating client:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
