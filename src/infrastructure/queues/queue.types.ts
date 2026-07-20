import type { QueueName } from './queue.names';

export type JobPayload = Record<string, unknown>;

export interface EnqueueResult {
  jobId: string;
}

export interface QueueMetrics {
  backend: 'memory' | 'bullmq';
  queues: Record<
    string,
    {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      deadLetter: number;
    }
  >;
}

export interface QueueBackend {
  enqueue(
    queueName: QueueName,
    jobName: string,
    data: JobPayload,
  ): Promise<EnqueueResult>;
  getMetrics(): QueueMetrics;
  /** Explicit start — not Nest lifecycle (avoids dual backend init). */
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface JobProcessor {
  process(
    queueName: QueueName,
    jobName: string,
    data: JobPayload,
  ): Promise<void>;
}
