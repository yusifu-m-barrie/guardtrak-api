import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { applyDevelopmentDefaults, validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { SharedModule } from './shared/shared.module';
import { AuthModule } from './modules/auth/auth.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { RedisModule } from './infrastructure/redis/redis.module';
import { QueueModule } from './infrastructure/queues/queue.module';
import { MetricsModule } from './infrastructure/metrics/metrics.module';
import { ApiKeysModule } from './infrastructure/api-keys/api-keys.module';
import { CacheModule } from './infrastructure/cache/cache.module';
import { SecurityIntelModule } from './common/security/security-intel.module';
import { OrganisationsModule } from './modules/organisations/organisations.module';
import { UsersModule } from './modules/users/users.module';
import { OfficersModule } from './modules/officers/officers.module';
import { SupervisorsModule } from './modules/supervisors/supervisors.module';
import { ClientsModule } from './modules/clients/clients.module';
import { SitesModule } from './modules/sites/sites.module';
import { DevicesModule } from './modules/devices/devices.module';
import { ShiftsModule } from './modules/shifts/shifts.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { BreaksModule } from './modules/breaks/breaks.module';
import { PatrolRoutesModule } from './modules/patrol-routes/patrol-routes.module';
import { PatrolCheckpointsModule } from './modules/patrol-checkpoints/patrol-checkpoints.module';
import { PatrolAssignmentsModule } from './modules/patrol-assignments/patrol-assignments.module';
import { PatrolVisitsModule } from './modules/patrol-visits/patrol-visits.module';
import { StorageModule } from './modules/storage/storage.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { EvidenceModule } from './modules/evidence/evidence.module';
import { EmergenciesModule } from './modules/emergencies/emergencies.module';
import { SupportModule } from './modules/support/support.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SyncModule } from './modules/sync/sync.module';
import { EmailModule } from './modules/email/email.module';
import { PushModule } from './modules/push/push.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { AdminModule } from './modules/admin/admin.module';
import { ApiVersionMiddleware } from './common/middleware/api-version.middleware';
import { SuspiciousRequestMiddleware } from './common/middleware/suspicious-request.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: (config) => {
        const validated = validateEnv(applyDevelopmentDefaults(config));
        process.env.NODE_ENV = validated.NODE_ENV;
        process.env.PORT = String(validated.PORT);
        process.env.API_PREFIX = validated.API_PREFIX;
        process.env.JWT_ACCESS_SECRET = validated.JWT_ACCESS_SECRET;
        process.env.JWT_REFRESH_SECRET = validated.JWT_REFRESH_SECRET;
        process.env.JWT_ACCESS_EXPIRES_IN = validated.JWT_ACCESS_EXPIRES_IN;
        process.env.JWT_REFRESH_EXPIRES_IN = validated.JWT_REFRESH_EXPIRES_IN;
        process.env.JWT_ISSUER = validated.JWT_ISSUER;
        process.env.JWT_AUDIENCE = validated.JWT_AUDIENCE;
        process.env.AUTH_MAX_FAILED_ATTEMPTS = String(
          validated.AUTH_MAX_FAILED_ATTEMPTS,
        );
        process.env.AUTH_LOCKOUT_MINUTES = String(
          validated.AUTH_LOCKOUT_MINUTES,
        );
        process.env.AUTH_PASSWORD_RESET_OTP_EXPIRES_MINUTES = String(
          validated.AUTH_PASSWORD_RESET_OTP_EXPIRES_MINUTES,
        );
        process.env.AUTH_PASSWORD_RESET_MAX_ATTEMPTS = String(
          validated.AUTH_PASSWORD_RESET_MAX_ATTEMPTS,
        );
        process.env.AUTH_RESET_TOKEN_EXPIRES_MINUTES = String(
          validated.AUTH_RESET_TOKEN_EXPIRES_MINUTES,
        );
        if (validated.AUTH_ALLOW_DEV_OTP_OUTPUT !== undefined) {
          process.env.AUTH_ALLOW_DEV_OTP_OUTPUT = String(
            validated.AUTH_ALLOW_DEV_OTP_OUTPUT,
          );
        }
        if (validated.AUTH_NEW_DEVICE_AUTO_APPROVE !== undefined) {
          process.env.AUTH_NEW_DEVICE_AUTO_APPROVE = String(
            validated.AUTH_NEW_DEVICE_AUTO_APPROVE,
          );
        }
        process.env.AUTH_PASSWORD_HISTORY_COUNT = String(
          validated.AUTH_PASSWORD_HISTORY_COUNT,
        );
        process.env.AUTH_PASSWORD_MAX_AGE_DAYS = String(
          validated.AUTH_PASSWORD_MAX_AGE_DAYS,
        );
        process.env.AUTH_STRICT_FINGERPRINT = String(
          validated.AUTH_STRICT_FINGERPRINT,
        );
        process.env.CORS_ORIGINS = validated.CORS_ORIGINS;
        process.env.LOG_LEVEL = validated.LOG_LEVEL;
        process.env.RATE_LIMIT_TTL = String(validated.RATE_LIMIT_TTL);
        process.env.RATE_LIMIT_LIMIT = String(validated.RATE_LIMIT_LIMIT);
        process.env.STORAGE_PROVIDER = validated.STORAGE_PROVIDER;
        process.env.MAX_IMAGE_SIZE_BYTES = String(
          validated.MAX_IMAGE_SIZE_BYTES,
        );
        process.env.MAX_VIDEO_SIZE_BYTES = String(
          validated.MAX_VIDEO_SIZE_BYTES,
        );
        process.env.SHIFT_MAX_DURATION_HOURS = String(
          validated.SHIFT_MAX_DURATION_HOURS,
        );
        process.env.ATTENDANCE_CLOCK_IN_EARLY_MINUTES = String(
          validated.ATTENDANCE_CLOCK_IN_EARLY_MINUTES,
        );
        process.env.ATTENDANCE_DEVICE_TIME_TOLERANCE_MINUTES = String(
          validated.ATTENDANCE_DEVICE_TIME_TOLERANCE_MINUTES,
        );
        process.env.ATTENDANCE_IDEMPOTENCY_TTL_SECONDS = String(
          validated.ATTENDANCE_IDEMPOTENCY_TTL_SECONDS,
        );
        process.env.PATROL_DEVICE_TIME_TOLERANCE_MINUTES = String(
          validated.PATROL_DEVICE_TIME_TOLERANCE_MINUTES,
        );
        process.env.PATROL_OFFLINE_REVIEW_THRESHOLD_MINUTES = String(
          validated.PATROL_OFFLINE_REVIEW_THRESHOLD_MINUTES,
        );
        process.env.PATROL_START_EARLY_MINUTES = String(
          validated.PATROL_START_EARLY_MINUTES,
        );
        process.env.PATROL_START_LATE_MINUTES = String(
          validated.PATROL_START_LATE_MINUTES,
        );
        process.env.PATROL_MAX_CHECKPOINT_RADIUS_METERS = String(
          validated.PATROL_MAX_CHECKPOINT_RADIUS_METERS,
        );
        process.env.PATROL_REQUIRE_SEQUENTIAL_CHECKPOINTS = String(
          validated.PATROL_REQUIRE_SEQUENTIAL_CHECKPOINTS,
        );
        process.env.PATROL_IDEMPOTENCY_TTL_SECONDS = String(
          validated.PATROL_IDEMPOTENCY_TTL_SECONDS,
        );
        process.env.INCIDENT_IDEMPOTENCY_TTL_SECONDS = String(
          validated.INCIDENT_IDEMPOTENCY_TTL_SECONDS,
        );
        process.env.EMERGENCY_IDEMPOTENCY_TTL_SECONDS = String(
          validated.EMERGENCY_IDEMPOTENCY_TTL_SECONDS,
        );
        process.env.SYNC_IDEMPOTENCY_TTL_SECONDS = String(
          validated.SYNC_IDEMPOTENCY_TTL_SECONDS,
        );
        process.env.STORAGE_SIGNED_URL_TTL_SECONDS = String(
          validated.STORAGE_SIGNED_URL_TTL_SECONDS,
        );
        process.env.STORAGE_LOCAL_ROOT = validated.STORAGE_LOCAL_ROOT;
        process.env.REDIS_ENABLED = String(validated.REDIS_ENABLED);
        process.env.REDIS_URL = validated.REDIS_URL;
        process.env.REDIS_KEY_PREFIX = validated.REDIS_KEY_PREFIX;
        process.env.QUEUE_ENABLED = String(validated.QUEUE_ENABLED);
        process.env.QUEUE_CONCURRENCY = String(validated.QUEUE_CONCURRENCY);
        process.env.FCM_ENABLED = String(validated.FCM_ENABLED);
        process.env.FCM_PROJECT_ID = validated.FCM_PROJECT_ID;
        process.env.FCM_CLIENT_EMAIL = validated.FCM_CLIENT_EMAIL;
        process.env.FCM_PRIVATE_KEY = validated.FCM_PRIVATE_KEY;
        process.env.APNS_ENABLED = String(validated.APNS_ENABLED);
        process.env.APNS_KEY_ID = validated.APNS_KEY_ID;
        process.env.APNS_TEAM_ID = validated.APNS_TEAM_ID;
        process.env.APNS_BUNDLE_ID = validated.APNS_BUNDLE_ID;
        process.env.APNS_KEY_PATH = validated.APNS_KEY_PATH;
        process.env.EMAIL_ENABLED = String(validated.EMAIL_ENABLED);
        process.env.EMAIL_PROVIDER = validated.EMAIL_PROVIDER;
        process.env.SMTP_HOST = validated.SMTP_HOST;
        process.env.SMTP_PORT = String(validated.SMTP_PORT);
        process.env.SMTP_USER = validated.SMTP_USER;
        process.env.SMTP_PASS = validated.SMTP_PASS;
        process.env.SMTP_FROM = validated.SMTP_FROM;
        process.env.EMAIL_RESEND_API_KEY = validated.EMAIL_RESEND_API_KEY;
        process.env.AWS_SES_REGION = validated.AWS_SES_REGION;
        process.env.WS_ENABLED = String(validated.WS_ENABLED);
        process.env.WS_CORS_ORIGINS = validated.WS_CORS_ORIGINS;
        process.env.METRICS_ENABLED = String(validated.METRICS_ENABLED);
        process.env.TRUST_PROXY = String(validated.TRUST_PROXY);
        process.env.COMPRESSION_ENABLED = String(validated.COMPRESSION_ENABLED);
        return validated;
      },
    }),
    EventEmitterModule.forRoot({
      wildcard: false,
      global: true,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.get<number>('rateLimit.ttl') ?? 60_000,
          limit: configService.get<number>('rateLimit.limit') ?? 100,
        },
      ],
    }),
    DatabaseModule,
    SharedModule,
    RedisModule,
    QueueModule,
    MetricsModule,
    ApiKeysModule,
    CacheModule,
    SecurityIntelModule,
    EmailModule,
    PushModule,
    RealtimeModule,
    HealthModule,
    AuthModule,
    AdminModule,
    OrganisationsModule,
    UsersModule,
    OfficersModule,
    SupervisorsModule,
    ClientsModule,
    SitesModule,
    DevicesModule,
    ShiftsModule,
    AssignmentsModule,
    AttendanceModule,
    BreaksModule,
    PatrolRoutesModule,
    PatrolCheckpointsModule,
    PatrolAssignmentsModule,
    PatrolVisitsModule,
    StorageModule,
    NotificationsModule,
    IncidentsModule,
    EvidenceModule,
    EmergenciesModule,
    SupportModule,
    ReportsModule,
    SyncModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(
        RequestIdMiddleware,
        ApiVersionMiddleware,
        SuspiciousRequestMiddleware,
      )
      .forRoutes('{*path}');
  }
}
