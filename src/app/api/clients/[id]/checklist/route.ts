/**
 * POST /api/clients/[id]/checklist
 * Record client review checklist actions (audit trail in outreach_tracking)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const ChecklistActionSchema = z.object({
  action: z.enum([
    'subscription_verified',
    'initial_payment_confirmed',
    'onboarding_complete',
    'payment_method_updated',
    'billing_issue_resolved',
    'client_contacted',
  ]),
  notes: z.string().optional(),
});

export async function POST(
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
    const validatedData = ChecklistActionSchema.parse(body);

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

    // Record the action in outreach_tracking for audit trail
    const checklistEntry = await prisma.outreachTracking.create({
      data: {
        businessId: id,
        createdByUserId: session.user.id,
        channel: 'email', // Using email as a generic channel for internal notes
        occurredAt: new Date(),
        outcome: validatedData.action,
        notes: validatedData.notes || `Checklist: ${validatedData.action}`,
      },
      include: {
        createdByUser: {
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
      checklistEntry,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error recording checklist action:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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

    // Fetch checklist entries from outreach_tracking
    const checklistEntries = await prisma.outreachTracking.findMany({
      where: {
        businessId: id,
        outcome: {
          in: [
            'subscription_verified',
            'initial_payment_confirmed',
            'onboarding_complete',
            'payment_method_updated',
            'billing_issue_resolved',
            'client_contacted',
          ],
        },
      },
      orderBy: { occurredAt: 'desc' },
      include: {
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      checklistEntries,
    });
  } catch (error: unknown) {
    console.error('Error fetching checklist:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
