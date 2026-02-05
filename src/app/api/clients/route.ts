/**
 * GET /api/clients
 * List all clients with filtering and sorting
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const ClientsQuerySchema = z.object({
  subscriptionStatus: z.string().optional(),
  clientStatus: z.string().optional(),
  needsAttention: z.enum(['true', 'false']).optional(),
  sortBy: z.enum(['name', 'convertedAt', 'nextPaymentDueDate', 'updatedAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const validated = ClientsQuerySchema.parse(queryParams);

    const where: any = {
      isClient: true,
    };

    // Apply filters
    if (validated.subscriptionStatus) {
      where.subscriptionStatus = validated.subscriptionStatus;
    }

    if (validated.clientStatus) {
      where.clientStatus = validated.clientStatus;
    }

    // "Needs attention" filter - clients with issues
    if (validated.needsAttention === 'true') {
      where.OR = [
        { subscriptionStatus: { in: ['payment_failed', 'past_due', 'unpaid'] } },
        { clientStatus: 'needs_review' },
        { 
          nextPaymentDueDate: { 
            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Due within 7 days
          }
        },
      ];
    }

    // Build orderBy
    const sortBy = validated.sortBy || 'updatedAt';
    const sortOrder = validated.sortOrder || 'desc';
    const orderBy: any = { [sortBy]: sortOrder };

    const skip = (validated.page - 1) * validated.limit;

    const [clients, total] = await Promise.all([
      prisma.business.findMany({
        where,
        orderBy,
        skip,
        take: validated.limit,
        include: {
          convertedByUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          contactInfo: {
            select: {
              email: true,
              phone: true,
              facebookUrl: true,
              instagramUrl: true,
              linkedinUrl: true,
            },
          },
          outreachTracking: {
            orderBy: { occurredAt: 'desc' },
            take: 1,
            select: {
              occurredAt: true,
              channel: true,
            },
          },
        },
      }),
      prisma.business.count({ where }),
    ]);

    const clientsWithMetadata = clients.map(client => {
      const notesCount = client.notes ? 1 : 0;
      const lastContact = client.outreachTracking[0] || null;
      
      // Determine if client needs attention
      const needsAttention = 
        ['payment_failed', 'past_due', 'unpaid'].includes(client.subscriptionStatus || '') ||
        client.clientStatus === 'needs_review' ||
        (client.nextPaymentDueDate && new Date(client.nextPaymentDueDate) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

      return {
        ...client,
        notesCount,
        lastContact,
        needsAttention,
      };
    });

    return NextResponse.json({
      clients: clientsWithMetadata,
      pagination: {
        page: validated.page,
        limit: validated.limit,
        total,
        totalPages: Math.ceil(total / validated.limit),
      },
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error fetching clients:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
