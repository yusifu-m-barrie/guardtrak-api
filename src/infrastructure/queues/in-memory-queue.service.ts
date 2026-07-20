import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { MetricsService } from '../metrics/metrics.service';
import { QUEUE_NAMES, type QueueName } from './queue.names';
import { QueueJobProcessor } from './queue-job.processor';
import type {
  EnqueueResult,
  JobPayload,
  QueueBackend,
  QueueMetrics,
} from './queue.types';

interface InMemoryJob {
  id: string;
  queueName: QueueName;
  jobName: string;
  data: JobPayload;
  attempts: number;
  maxAttempts: number;
}

interface DeadLetterEntry extends InMemoryJob {
  failedAt: Date;
  error: string;
}

const ALL_QUEUE_NAMES = Object.values(QUEUE_NAMES);

@Injectable()
export class InMemoryQueueService implements QueueBackend {
  private readonly logger = new Logger(InMemoryQueueService.name);
  private readonly queues = new Map<QueueName, InMemoryJob[]>();
  private readonly deadLetterQueue: DeadLetterEntry[] = [];
  private readonly stats = new Map<
    QueueName,
    { waiting: number; active: number; completed: number; failed: number }
  >();
  private destroyed = false;

  constructor(
    private readonly jobProcessor: QueueJobProcessor,
    private readonly metricsService: MetricsService,
  ) {
    for (const queueName of ALL_QUEUE_NAMES) {
      this.queues.set(queueName, []);
      this.stats.set(queueName, {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
      });
    }
  }

  start(): Promise<void> {
    this.logger.log('In-memory queue backend active');
    return Promise.resolve();
  }

  stop(): Promise<void> {
    this.destroyed = true;
    return Promise.resolve();
  }

  enqueue(
    queueName: QueueName,
    jobName: string,
    data: JobPayload,
  ): Promise<EnqueueResult> {
    const job: InMemoryJob = {
      id: randomUUID(),
      queueName,
      jobName,
      data,
      attempts: 0,
      maxAttempts: 3,
    };

    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Unknown queue: ${queueName}`);
    }

    queue.push(job);
    this.bumpStat(queueName, 'waiting', 1);
    setImmediate(() => {
      void this.processNext(queueName);
    });

    return Promise.resolve({ jobId: job.id });
  }

  getMetrics(): QueueMetrics {
    const queues: QueueMetrics['queues'] = {};

    for (const queueName of ALL_QUEUE_NAMES) {
      const stat = this.stats.get(queueName) ?? {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
      };
      const waiting = this.queues.get(queueName)?.length ?? 0;
      queues[queueName] = {
        waiting,
        active: stat.active,
        completed: stat.completed,
        failed: stat.failed,
        deadLetter: this.deadLetterQueue.filter(
          (entry) => entry.queueName === queueName,
        ).length,
      };
    }

    return { backend: 'memory', queues };
  }

  private async processNext(queueName: QueueName): Promise<void> {
    if (this.destroyed) {
      return;
    }

    const queue = this.queues.get(queueName);
    if (!queue || queue.length === 0) {
      return;
    }

    const job = queue.shift();
    if (!job) {
      return;
    }

    this.bumpStat(queueName, 'waiting', -1);
    this.bumpStat(queueName, 'active', 1);

    try {
      await this.jobProcessor.process(job.queueName, job.jobName, job.data);
      this.bumpStat(queueName, 'active', -1);
      this.bumpStat(queueName, 'completed', 1);
      this.metricsService.recordQueue(queueName, 'completed');
    } catch (error) {
      job.attempts += 1;
      const message =
        error instanceof Error ? error.message : 'Unknown processing error';

      if (job.attempts < job.maxAttempts) {
        this.bumpStat(queueName, 'active', -1);
        queue.push(job);
        this.bumpStat(queueName, 'waiting', 1);
        setImmediate(() => {
          void this.processNext(queueName);
        });
        return;
      }

      this.bumpStat(queueName, 'active', -1);
      this.bumpStat(queueName, 'failed', 1);
      this.metricsService.recordQueue(queueName, 'failed');
      this.deadLetterQueue.push({
        ...job,
        failedAt: new Date(),
        error: message,
      });
      this.metricsService.recordQueue(queueName, 'dead_letter');
      this.logger.error(
        `Job moved to DLQ: ${queueName}/${job.jobName} (${job.id}) — ${message}`,
      );
    }

    if (queue.length > 0) {
      setImmediate(() => {
        void this.processNext(queueName);
      });
    }
  }

  private bumpStat(
    queueName: QueueName,
    field: 'waiting' | 'active' | 'completed' | 'failed',
    delta: number,
  ): void {
    const stat = this.stats.get(queueName);
    if (!stat) {
      return;
    }
    stat[field] = Math.max(0, stat[field] + delta);
  }
}
