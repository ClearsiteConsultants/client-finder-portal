/**
 * API endpoint for processing validation/scraping jobs
 * POST /api/jobs/process
 * 
 * This endpoint processes queued jobs. It can be called:
 * - On-demand from the UI
 * - Via Vercel Cron Jobs for scheduled processing
 * - After search ingestion to immediately start processing
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { JobQueueService } from '@/lib/jobs/queue-service';
import { JobProcessor } from '@/lib/jobs/processor';

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

    // Parse optional parameters
    const body = await request.json().catch(() => ({}));
    const maxJobs = body.maxJobs || 10; // Process up to 10 jobs per request
    const timeout = body.timeout || 25000; // Max 25 seconds (Vercel limit is 30s for hobby plan)

    const jobQueue = new JobQueueService();
    const processor = new JobProcessor();

    const startTime = Date.now();
    const processed: string[] = [];
    const failed: string[] = [];

    // Process jobs until we hit max jobs or timeout
    while (processed.length + failed.length < maxJobs) {
      // Check timeout
      if (Date.now() - startTime > timeout) {
        break;
      }

      // Get next job
      const job = await jobQueue.getNextJob();
      if (!job) {
        // No more jobs to process
        break;
      }

      try {
        // Process the job
        const result = await processor.processJob(job.businessId, job.jobType);

        if (result.success) {
          await jobQueue.markJobSuccess(job.id);
          processed.push(job.id);
        } else {
          await jobQueue.markJobFailure(job.id, result.error || 'Unknown error');
          failed.push(job.id);
        }
      } catch (error) {
        // Unexpected error during processing
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        await jobQueue.markJobFailure(job.id, errorMsg);
        failed.push(job.id);
      }
    }

    // Get remaining pending count
    const pendingCount = await jobQueue.getPendingJobCount();

    return NextResponse.json({
      success: true,
      processed: processed.length,
      failed: failed.length,
      pendingCount,
      processingTimeMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error('Error in jobs process API:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
