/**
 * API endpoint for checking job queue status
 * GET /api/jobs/status
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { JobQueueService } from '@/lib/jobs/queue-service';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const jobQueue = new JobQueueService();

    // Get counts by status
    const [queuedCount, runningCount, successCount, failureCount] = await Promise.all([
      prisma.validationJob.count({ where: { status: 'queued' } }),
      prisma.validationJob.count({ where: { status: 'running' } }),
      prisma.validationJob.count({ where: { status: 'success' } }),
      prisma.validationJob.count({ where: { status: 'failure' } }),
    ]);

    // Get recent failed jobs for debugging
    const recentFailures = await prisma.validationJob.findMany({
      where: { status: 'failure' },
      orderBy: { completedAt: 'desc' },
      take: 5,
      include: {
        business: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      queued: queuedCount,
      running: runningCount,
      success: successCount,
      failure: failureCount,
      total: queuedCount + runningCount + successCount + failureCount,
      recentFailures: recentFailures.map((job) => ({
        id: job.id,
        jobType: job.jobType,
        businessName: job.business.name,
        retryCount: job.retryCount,
        lastError: job.lastError,
        completedAt: job.completedAt,
      })),
    });
  } catch (error) {
    console.error('Error in jobs status API:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
