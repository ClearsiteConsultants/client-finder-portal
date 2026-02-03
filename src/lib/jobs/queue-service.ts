/**
 * Job Queue Service for Background Validation/Scraping
 * 
 * This service manages asynchronous validation and scraping jobs
 * to avoid blocking the UI during search ingestion.
 */

import { prisma } from '../prisma';
import { ValidationJobType, ValidationJobStatus } from '@prisma/client';

export interface EnqueueJobOptions {
  businessId: string;
  jobType: ValidationJobType;
}

export interface JobResult {
  success: boolean;
  error?: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000; // Base delay for exponential backoff

export class JobQueueService {
  /**
   * Enqueue a new validation/scraping job
   */
  async enqueueJob(options: EnqueueJobOptions): Promise<string> {
    // Check if a job already exists for this business and type
    const existing = await prisma.validationJob.findFirst({
      where: {
        businessId: options.businessId,
        jobType: options.jobType,
        status: {
          in: ['queued', 'running'],
        },
      },
    });

    if (existing) {
      // Return existing job ID instead of creating duplicate
      return existing.id;
    }

    // Create new job
    const job = await prisma.validationJob.create({
      data: {
        businessId: options.businessId,
        jobType: options.jobType,
        status: 'queued',
      },
    });

    return job.id;
  }

  /**
   * Enqueue multiple jobs in batch
   */
  async enqueueJobsBatch(jobs: EnqueueJobOptions[]): Promise<string[]> {
    const jobIds: string[] = [];
    
    for (const job of jobs) {
      const jobId = await this.enqueueJob(job);
      jobIds.push(jobId);
    }

    return jobIds;
  }

  /**
   * Get next available job to process
   */
  async getNextJob(): Promise<{ id: string; businessId: string; jobType: ValidationJobType } | null> {
    // Use a transaction to atomically claim a job
    try {
      const job = await prisma.$transaction(async (tx) => {
        // Find oldest queued job
        const nextJob = await tx.validationJob.findFirst({
          where: {
            status: 'queued',
            retryCount: {
              lt: MAX_RETRIES,
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        });

        if (!nextJob) {
          return null;
        }

        // Mark it as running
        const updated = await tx.validationJob.update({
          where: { id: nextJob.id },
          data: {
            status: 'running',
            startedAt: new Date(),
          },
        });

        return updated;
      });

      return job;
    } catch (error) {
      console.error('Error getting next job:', error);
      return null;
    }
  }

  /**
   * Mark job as completed successfully
   */
  async markJobSuccess(jobId: string): Promise<void> {
    await prisma.validationJob.update({
      where: { id: jobId },
      data: {
        status: 'success',
        completedAt: new Date(),
        lastError: null,
      },
    });
  }

  /**
   * Mark job as failed and handle retry logic
   */
  async markJobFailure(jobId: string, error: string): Promise<void> {
    const job = await prisma.validationJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return;
    }

    const newRetryCount = job.retryCount + 1;
    const shouldRetry = newRetryCount < MAX_RETRIES;

    await prisma.validationJob.update({
      where: { id: jobId },
      data: {
        status: shouldRetry ? 'queued' : 'failure',
        retryCount: newRetryCount,
        lastError: error,
        completedAt: shouldRetry ? null : new Date(),
        startedAt: null, // Reset startedAt for retry
      },
    });
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string) {
    return await prisma.validationJob.findUnique({
      where: { id: jobId },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            websiteStatus: true,
          },
        },
      },
    });
  }

  /**
   * Get pending job count
   */
  async getPendingJobCount(): Promise<number> {
    return await prisma.validationJob.count({
      where: {
        status: {
          in: ['queued', 'running'],
        },
      },
    });
  }

  /**
   * Retry a specific failed job
   */
  async retryJob(jobId: string): Promise<boolean> {
    try {
      const job = await prisma.validationJob.findUnique({
        where: { id: jobId },
      });

      if (!job || job.status !== 'failure') {
        return false;
      }

      await prisma.validationJob.update({
        where: { id: jobId },
        data: {
          status: 'queued',
          retryCount: 0, // Reset retry count for manual retry
          lastError: null,
          startedAt: null,
          completedAt: null,
        },
      });

      return true;
    } catch (error) {
      console.error('Error retrying job:', error);
      return false;
    }
  }
}
