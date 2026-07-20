import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker, type ConnectionOptions } from 'bullmq';
import { RedisService } from '../redis/redis.service';
import { MetricsService } from '../metrics/metrics.service';
import { QUEUE_NAMES, type QueueName } from './queue.names';
import { QueueJobProcessor } from './queue-job.processor';
import type {
  EnqueueResult,
  JobPayload,
  QueueBackend,
  QueueMetrics,
} from './queue.types';

const ALL_QUEUE_NAMES = Object.values(QUEUE_NAMES);
const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 1000 },
  removeOnComplete: 100,
  removeOnFail: false,
};

@Injectable()
export class BullMqQueueService implements QueueBackend {
  private readonly logger = new Logger(BullMqQueueService.name);
  private readonly queues = new Map<QueueName, Queue>();
  private readonly workers = new Map<QueueName, Worker>();
  private readonly deadLetterQueue: Array<{
    queueName: QueueName;
    jobName: string;
    jobId: string;
    data: JobPayload;
    failedAt: Date;
    error: string;
  }> = [];
  private readonly stats = new Map<
    QueueName,
    { completed: number; failed: number }
  >();
  private connection: ConnectionOptions | null = null;
  private concurrency = 2;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly jobProcessor: QueueJobProcessor,
    private readonly metricsService: MetricsService,
  ) {
    for (const queueName of ALL_QUEUE_NAMES) {
      this.stats.set(queueName, { completed: 0, failed: 0 });
    }
  }

  start(): Promise<void> {
    if (!this.redisService.isUsingRedis()) {
      throw new Error('BullMQ requires an active Redis connection');
    }

    this.concurrency = this.configService.get<number>('queue.concurrency') ?? 2;
    const url =
      this.configService.get<string>('redis.url') ?? 'redis://localhost:6379';
    this.connection = { url };

    for (const queueName of ALL_QUEUE_NAMES) {
      const queue = new Queue(queueName, { connection: this.connection });
      const worker = new Worker(
        queueName,
        async (job: Job<JobPayload>) => {
          await this.jobProcessor.process(queueName, job.name, job.data ?? {});
        },
        {
          connection: this.connection,
          concurrency: this.concurrency,
        },
      );

      worker.on('completed', (job) => {
        const stat = this.stats.get(queueName);
        if (stat) {
          stat.completed += 1;
        }
        this.metricsService.recordQueue(queueName, 'completed');
        this.logger.debug(`Completed ${queueName}/${job.name} (${job.id})`);
      });

      worker.on('failed', (job, error) => {
        const stat = this.stats.get(queueName);
        if (stat) {
          stat.failed += 1;
        }
        this.metricsService.recordQueue(queueName, 'failed');

        if (
          job &&
          job.attemptsMade >=
            (job.opts.attempts ?? DEFAULT_JOB_OPTIONS.attempts)
        ) {
          this.deadLetterQueue.push({
            queueName,
            jobName: job.name,
            jobId: job.id ?? randomUUID(),
            data: job.data ?? {},
            failedAt: new Date(),
            error: error.message,
          });
          this.metricsService.recordQueue(queueName, 'dead_letter');
          this.logger.error(
            `Job moved to DLQ: ${queueName}/${job.name} (${job.id}) — ${error.message}`,
          );
        }
      });

      this.queues.set(queueName, queue);
      this.workers.set(queueName, worker);
    }

    this.logger.log(
      `BullMQ queue backend active (concurrency=${this.concurrency})`,
    );
    return Promise.resolve();
  }

  async stop(): Promise<void> {
    await Promise.all(
      [...this.workers.values()].map((worker) => worker.close()),
    );
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
    this.workers.clear();
    this.queues.clear();
  }

  async enqueue(
    queueName: QueueName,
    jobName: string,
    data: JobPayload,
  ): Promise<EnqueueResult> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Unknown queue: ${queueName}`);
    }

    const job = await queue.add(jobName, data, DEFAULT_JOB_OPTIONS);
    return { jobId: job.id ?? randomUUID() };
  }

  getMetrics(): QueueMetrics {
    const queues: QueueMetrics['queues'] = {};

    for (const queueName of ALL_QUEUE_NAMES) {
      const stat = this.stats.get(queueName) ?? { completed: 0, failed: 0 };
      queues[queueName] = {
        waiting: 0,
        active: 0,
        completed: stat.completed,
        failed: stat.failed,
        deadLetter: this.deadLetterQueue.filter(
          (entry) => entry.queueName === queueName,
        ).length,
      };
    }

    return { backend: 'bullmq', queues };
  }
}
