/**
 * Tests for JobQueueService
 * Verifies job state transitions: queued → running → success/failure
 */

import { JobQueueService } from './queue-service';
import { prisma } from '../prisma';
import { ValidationJobType } from '@prisma/client';

// Mock prisma
jest.mock('../prisma', () => ({
  prisma: {
    validationJob: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

describe('JobQueueService', () => {
  let service: JobQueueService;
  const mockBusinessId = 'business-123';
  const mockJobId = 'job-456';

  beforeEach(() => {
    service = new JobQueueService();
    jest.clearAllMocks();
  });

  describe('enqueueJob', () => {
    it('should create a new job when none exists', async () => {
      const mockJob = {
        id: mockJobId,
        businessId: mockBusinessId,
        jobType: 'website_validation' as ValidationJobType,
        status: 'queued' as const,
        createdAt: new Date(),
        startedAt: null,
        completedAt: null,
        retryCount: 0,
        lastError: null,
      };

      (prisma.validationJob.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.validationJob.create as jest.Mock).mockResolvedValue(mockJob);

      const jobId = await service.enqueueJob({
        businessId: mockBusinessId,
        jobType: 'website_validation',
      });

      expect(jobId).toBe(mockJobId);
      expect(prisma.validationJob.create).toHaveBeenCalledWith({
        data: {
          businessId: mockBusinessId,
          jobType: 'website_validation',
          status: 'queued',
        },
      });
    });

    it('should return existing job ID if job already queued', async () => {
      const existingJob = {
        id: mockJobId,
        businessId: mockBusinessId,
        jobType: 'website_validation' as ValidationJobType,
        status: 'queued' as const,
      };

      (prisma.validationJob.findFirst as jest.Mock).mockResolvedValue(existingJob);

      const jobId = await service.enqueueJob({
        businessId: mockBusinessId,
        jobType: 'website_validation',
      });

      expect(jobId).toBe(mockJobId);
      expect(prisma.validationJob.create).not.toHaveBeenCalled();
    });
  });

  describe('getNextJob - job state transition to running', () => {
    it('should transition job from queued to running', async () => {
      const queuedJob = {
        id: mockJobId,
        businessId: mockBusinessId,
        jobType: 'website_validation' as ValidationJobType,
        status: 'queued' as const,
        retryCount: 0,
      };

      const runningJob = {
        ...queuedJob,
        status: 'running' as const,
        startedAt: new Date(),
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback({
          validationJob: {
            findFirst: jest.fn().mockResolvedValue(queuedJob),
            update: jest.fn().mockResolvedValue(runningJob),
          },
        });
      });

      const job = await service.getNextJob();

      expect(job).toBeTruthy();
      expect(job?.id).toBe(mockJobId);
    });

    it('should return null when no jobs are queued', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback({
          validationJob: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
        });
      });

      const job = await service.getNextJob();

      expect(job).toBeNull();
    });
  });

  describe('markJobSuccess - job state transition to success', () => {
    it('should transition job from running to success', async () => {
      await service.markJobSuccess(mockJobId);

      expect(prisma.validationJob.update).toHaveBeenCalledWith({
        where: { id: mockJobId },
        data: {
          status: 'success',
          completedAt: expect.any(Date),
          lastError: null,
        },
      });
    });
  });

  describe('markJobFailure - job state transition to failure or retry', () => {
    it('should transition to queued for retry when retry count < max', async () => {
      const job = {
        id: mockJobId,
        retryCount: 1,
      };

      (prisma.validationJob.findUnique as jest.Mock).mockResolvedValue(job);

      await service.markJobFailure(mockJobId, 'Test error');

      expect(prisma.validationJob.update).toHaveBeenCalledWith({
        where: { id: mockJobId },
        data: {
          status: 'queued', // Should retry
          retryCount: 2,
          lastError: 'Test error',
          completedAt: null,
          startedAt: null,
        },
      });
    });

    it('should transition to failure when retry count >= max', async () => {
      const job = {
        id: mockJobId,
        retryCount: 3, // MAX_RETRIES is 3
      };

      (prisma.validationJob.findUnique as jest.Mock).mockResolvedValue(job);

      await service.markJobFailure(mockJobId, 'Test error');

      expect(prisma.validationJob.update).toHaveBeenCalledWith({
        where: { id: mockJobId },
        data: {
          status: 'failure', // Should not retry
          retryCount: 4,
          lastError: 'Test error',
          completedAt: expect.any(Date),
          startedAt: null,
        },
      });
    });
  });

  describe('retryJob', () => {
    it('should reset a failed job to queued state', async () => {
      const failedJob = {
        id: mockJobId,
        status: 'failure' as const,
        retryCount: 3,
      };

      (prisma.validationJob.findUnique as jest.Mock).mockResolvedValue(failedJob);
      (prisma.validationJob.update as jest.Mock).mockResolvedValue({ ...failedJob, status: 'queued' });

      const result = await service.retryJob(mockJobId);

      expect(result).toBe(true);
      expect(prisma.validationJob.update).toHaveBeenCalledWith({
        where: { id: mockJobId },
        data: {
          status: 'queued',
          retryCount: 0,
          lastError: null,
          startedAt: null,
          completedAt: null,
        },
      });
    });

    it('should return false for non-failed jobs', async () => {
      const runningJob = {
        id: mockJobId,
        status: 'running' as const,
      };

      (prisma.validationJob.findUnique as jest.Mock).mockResolvedValue(runningJob);

      const result = await service.retryJob(mockJobId);

      expect(result).toBe(false);
      expect(prisma.validationJob.update).not.toHaveBeenCalled();
    });
  });

  describe('getPendingJobCount', () => {
    it('should count queued and running jobs', async () => {
      (prisma.validationJob.count as jest.Mock).mockResolvedValue(5);

      const count = await service.getPendingJobCount();

      expect(count).toBe(5);
      expect(prisma.validationJob.count).toHaveBeenCalledWith({
        where: {
          status: {
            in: ['queued', 'running'],
          },
        },
      });
    });
  });
});
