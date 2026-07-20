import { Global, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { BullMqQueueService } from './bullmq.queue.service';
import { InMemoryQueueService } from './in-memory-queue.service';
import { JobsService } from './jobs.service';
import { QueueJobProcessor } from './queue-job.processor';

@Global()
@Module({
  providers: [
    QueueJobProcessor,
    InMemoryQueueService,
    BullMqQueueService,
    JobsService,
  ],
  exports: [JobsService],
})
export class QueueModule implements OnModuleInit, OnModuleDestroy {
  private activeBackend: InMemoryQueueService | BullMqQueueService | null =
    null;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly inMemoryQueueService: InMemoryQueueService,
    private readonly bullMqQueueService: BullMqQueueService,
    private readonly jobsService: JobsService,
  ) {}

  async onModuleInit(): Promise<void> {
    const redisEnabled =
      this.configService.get<boolean>('redis.enabled') === true;
    const queueEnabled =
      this.configService.get<boolean>('queue.enabled') === true;

    if (redisEnabled && queueEnabled && this.redisService.isUsingRedis()) {
      try {
        await this.bullMqQueueService.start();
        this.activeBackend = this.bullMqQueueService;
      } catch {
        await this.inMemoryQueueService.start();
        this.activeBackend = this.inMemoryQueueService;
      }
    } else {
      await this.inMemoryQueueService.start();
      this.activeBackend = this.inMemoryQueueService;
    }

    this.jobsService.setBackend(this.activeBackend);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.activeBackend) {
      await this.activeBackend.stop();
    }
  }
}
