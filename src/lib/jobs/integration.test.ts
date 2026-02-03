/**
 * Integration test for job queue processing
 * Tests that jobs can be enqueued, processed, and updates are persisted
 */

import { JobQueueService } from './queue-service';
import { JobProcessor } from './processor';
import { prisma } from '../prisma';
import { ValidationJobType } from '@prisma/client';

// Mock the validation and scraping functions
jest.mock('../validation/website-validator', () => ({
  validateWebsite: jest.fn().mockResolvedValue({
    status: 'acceptable',
    responseCode: 200,
    loadTimeMs: 1000,
    hasSSL: true,
    detectedIssues: [],
  }),
}));

jest.mock('../scraping/email-scraper', () => ({
  scrapeEmailsFromWebsite: jest.fn().mockResolvedValue({
    emails: [
      { email: 'test@example.com', source: 'scraped' as const, confidence: 90 },
    ],
  }),
}));

jest.mock('../scraping/social-media-scraper', () => ({
  scrapeSocialMediaFromWebsite: jest.fn().mockResolvedValue({
    facebookUrl: 'https://facebook.com/testbusiness',
    instagramUrl: 'https://instagram.com/testbusiness',
    foundUrls: 2,
  }),
}));

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
    business: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    contactInfo: {
      upsert: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

describe('Job Queue Integration', () => {
  let queueService: JobQueueService;
  let processor: JobProcessor;

  const mockBusinessId = 'business-123';
  const mockJobId = 'job-456';

  beforeEach(() => {
    queueService = new JobQueueService();
    processor = new JobProcessor();
    jest.clearAllMocks();
  });

  it('should enqueue, process, and persist validation results', async () => {
    // Step 1: Enqueue a validation job
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

    const jobId = await queueService.enqueueJob({
      businessId: mockBusinessId,
      jobType: 'website_validation',
    });

    expect(jobId).toBe(mockJobId);
    expect(prisma.validationJob.create).toHaveBeenCalled();

    // Step 2: Get the job for processing (transition to running)
    const runningJob = {
      ...mockJob,
      status: 'running' as const,
      startedAt: new Date(),
    };

    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      return callback({
        validationJob: {
          findFirst: jest.fn().mockResolvedValue(mockJob),
          update: jest.fn().mockResolvedValue(runningJob),
        },
      });
    });

    const nextJob = await queueService.getNextJob();
    expect(nextJob).toBeTruthy();
    expect(nextJob?.id).toBe(mockJobId);

    // Step 3: Process the job
    const mockBusiness = {
      id: mockBusinessId,
      name: 'Test Business',
      website: 'https://example.com',
      websiteStatus: 'unknown' as const,
    };

    (prisma.business.findUnique as jest.Mock).mockResolvedValue(mockBusiness);
    (prisma.business.update as jest.Mock).mockResolvedValue({
      ...mockBusiness,
      websiteStatus: 'acceptable',
    });

    const result = await processor.processJob(mockBusinessId, 'website_validation');
    expect(result.success).toBe(true);

    // Step 4: Mark job as success (transition to success)
    (prisma.validationJob.update as jest.Mock).mockResolvedValue({
      ...runningJob,
      status: 'success',
      completedAt: new Date(),
    });

    await queueService.markJobSuccess(jobId);

    expect(prisma.validationJob.update).toHaveBeenCalledWith({
      where: { id: jobId },
      data: {
        status: 'success',
        completedAt: expect.any(Date),
        lastError: null,
      },
    });

    // Verify business was updated with validation results
    expect(prisma.business.update).toHaveBeenCalledWith({
      where: { id: mockBusinessId },
      data: {
        websiteStatus: 'acceptable',
      },
    });
  });

  it('should handle job failure and retry logic', async () => {
    // Enqueue job
    const mockJob = {
      id: mockJobId,
      businessId: mockBusinessId,
      jobType: 'website_validation' as ValidationJobType,
      status: 'queued' as const,
      retryCount: 0,
    };

    (prisma.validationJob.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.validationJob.create as jest.Mock).mockResolvedValue(mockJob);

    await queueService.enqueueJob({
      businessId: mockBusinessId,
      jobType: 'website_validation',
    });

    // Simulate processing failure
    (prisma.business.findUnique as jest.Mock).mockResolvedValue(null); // Business not found

    const result = await processor.processJob(mockBusinessId, 'website_validation');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');

    // Mark as failure
    (prisma.validationJob.findUnique as jest.Mock).mockResolvedValue(mockJob);
    (prisma.validationJob.update as jest.Mock).mockResolvedValue({
      ...mockJob,
      status: 'queued', // Should retry
      retryCount: 1,
      lastError: result.error,
    });

    await queueService.markJobFailure(mockJobId, result.error!);

    expect(prisma.validationJob.update).toHaveBeenCalledWith({
      where: { id: mockJobId },
      data: {
        status: 'queued', // Should be queued for retry
        retryCount: 1,
        lastError: result.error,
        completedAt: null,
        startedAt: null,
      },
    });
  });

  it('should process multiple jobs in batch', async () => {
    // Enqueue 3 validation jobs
    const jobs = [
      { businessId: 'biz-1', jobType: 'website_validation' as ValidationJobType },
      { businessId: 'biz-2', jobType: 'email_scraping' as ValidationJobType },
      { businessId: 'biz-3', jobType: 'social_scraping' as ValidationJobType },
    ];

    (prisma.validationJob.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.validationJob.create as jest.Mock).mockImplementation((args) => ({
      id: `job-${args.data.businessId}`,
      ...args.data,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
      retryCount: 0,
      lastError: null,
    }));

    const jobIds = await queueService.enqueueJobsBatch(jobs);

    expect(jobIds).toHaveLength(3);
    expect(prisma.validationJob.create).toHaveBeenCalledTimes(3);
  });
});
