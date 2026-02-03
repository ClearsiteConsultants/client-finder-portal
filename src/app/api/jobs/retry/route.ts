/**
 * API endpoint for retrying failed jobs
 * POST /api/jobs/retry
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { JobQueueService } from '@/lib/jobs/queue-service';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    const jobQueue = new JobQueueService();
    const success = await jobQueue.retryJob(jobId);

    if (!success) {
      return NextResponse.json(
        { error: 'Job not found or not in failed state' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Job queued for retry',
    });
  } catch (error) {
    console.error('Error in jobs retry API:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
