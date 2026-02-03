# Background Job Processing for Website Validation

## Overview

The ClientFinder Portal now supports asynchronous background processing for website validation and scraping. This allows search ingestion to complete quickly without blocking the UI while validation and scraping tasks run in the background.

## Architecture

### Components

1. **ValidationJob Model** (`prisma/schema.prisma`)
   - Database table to store job queue
   - States: `queued`, `running`, `success`, `failure`
   - Supports automatic retries (max 3 attempts)

2. **JobQueueService** (`src/lib/jobs/queue-service.ts`)
   - Manages job enqueueing and state transitions
   - Atomic job claiming to prevent race conditions
   - Retry logic with exponential backoff

3. **JobProcessor** (`src/lib/jobs/processor.ts`)
   - Executes validation and scraping tasks
   - Updates business records with results
   - Handles three job types:
     - `website_validation` - Validates website status
     - `email_scraping` - Extracts email addresses
     - `social_scraping` - Finds social media profiles

4. **API Routes**
   - `POST /api/jobs/process` - Process queued jobs
   - `GET /api/jobs/status` - Check queue status
   - `POST /api/jobs/retry` - Retry failed jobs

### Integration

Jobs are automatically enqueued when businesses are discovered via the Places API search. The `PlacesService` enqueues validation jobs after creating or updating business records.

## Usage

### Automatic Job Enqueueing

Jobs are automatically created during search ingestion:

```typescript
// In PlacesService.search()
if (!exclusionCheck?.isExcluded && business.website) {
  // Enqueue validation job
  await jobQueue.enqueueJob({
    businessId: business.id,
    jobType: 'website_validation',
  });
  
  // Enqueue scraping jobs
  await jobQueue.enqueueJob({
    businessId: business.id,
    jobType: 'email_scraping',
  });
}
```

### Processing Jobs

#### Manual Processing
```bash
curl -X POST https://your-domain.com/api/jobs/process \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"maxJobs": 10, "timeout": 25000}'
```

#### Check Status
```bash
curl https://your-domain.com/api/jobs/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Retry Failed Job
```bash
curl -X POST https://your-domain.com/api/jobs/retry \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jobId": "job-uuid"}'
```

## Vercel Deployment

### Serverless Function Configuration

The job processor runs as a serverless function and is compatible with Vercel's constraints:

- **Execution Time**: Configurable timeout (default 25s, max 30s for hobby plan)
- **Processing Strategy**: Batch processing with time limits
- **Database Queue**: No external queue service required

### Cron Job Setup (Optional)

Add to `vercel.json` for automatic job processing:

```json
{
  "crons": [
    {
      "path": "/api/jobs/process",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

This triggers job processing every 5 minutes.

### Environment Requirements

- PostgreSQL database (for job queue)
- Authentication configured (NextAuth)

## Testing

### Unit Tests

```bash
npm test src/lib/jobs/queue-service.test.ts
```

Tests cover:
- Job state transitions (queued → running → success/failure)
- Retry logic
- Job enqueueing and deduplication

### Integration Tests

```bash
npm test src/lib/jobs/integration.test.ts
```

Tests cover:
- End-to-end job processing flow
- Multiple job types in batch
- Error handling and retries

## Monitoring

Check job queue status:

```typescript
import { JobQueueService } from '@/lib/jobs/queue-service';

const queue = new JobQueueService();
const pending = await queue.getPendingJobCount();
const status = await queue.getJobStatus(jobId);
```

Job status includes:
- Number of queued, running, successful, and failed jobs
- Recent failures with error messages
- Retry count for each job

## Performance Considerations

- Jobs are processed in FIFO order (oldest first)
- Maximum 3 retry attempts per job
- Duplicate jobs are prevented (one active job per business + job type)
- Batch processing limits (configurable maxJobs parameter)
- Timeout protection to prevent serverless function timeouts

## Future Enhancements

Potential improvements:
- Priority queue for urgent validations
- Scheduled re-validation of stale data
- Webhook notifications on job completion
- Job progress tracking for long-running tasks
