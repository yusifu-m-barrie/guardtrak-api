import { MetricsService } from '../metrics/metrics.service';
import { QueueJobProcessor } from './queue-job.processor';
import { InMemoryQueueService } from './in-memory-queue.service';
import { QUEUE_NAMES } from './queue.names';

describe('InMemoryQueueService', () => {
  let service: InMemoryQueueService;
  let metrics: MetricsService;
  let processor: { process: jest.Mock };

  beforeEach(async () => {
    metrics = new MetricsService();
    processor = { process: jest.fn().mockResolvedValue(undefined) };
    service = new InMemoryQueueService(
      processor as unknown as QueueJobProcessor,
      metrics,
    );
    await service.start();
  });

  afterEach(async () => {
    await service.stop();
  });

  it('enqueues and processes jobs', async () => {
    const result = await service.enqueue(QUEUE_NAMES.EMAILS, 'welcome', {
      to: 'user@example.com',
      displayName: 'User',
    });

    expect(result.jobId).toBeDefined();

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(processor.process).toHaveBeenCalledWith(
      QUEUE_NAMES.EMAILS,
      'welcome',
      expect.objectContaining({ to: 'user@example.com' }),
    );
  });

  it('moves jobs to DLQ after max retries', async () => {
    processor.process.mockRejectedValue(new Error('processing failed'));

    await service.enqueue(QUEUE_NAMES.CLEANUP, 'run', { task: 'test' });
    await new Promise((resolve) => setTimeout(resolve, 100));

    const queueMetrics = service.getMetrics();
    expect(queueMetrics.backend).toBe('memory');
    expect(
      queueMetrics.queues[QUEUE_NAMES.CLEANUP]?.deadLetter,
    ).toBeGreaterThan(0);
  });

  it('returns queue metrics', () => {
    const queueMetrics = service.getMetrics();
    expect(queueMetrics.backend).toBe('memory');
    expect(queueMetrics.queues[QUEUE_NAMES.EMAILS]).toBeDefined();
  });
});
