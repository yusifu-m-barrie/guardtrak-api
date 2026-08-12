import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const port = configService.get<number>('app.port') ?? 3000;
  const apiPrefix = configService.get<string>('app.apiPrefix') ?? 'api/v1';
  const nodeEnv = configService.get<string>('app.nodeEnv') ?? 'development';
  const corsOrigins = configService.get<string[]>('cors.origins') ?? [];
  const enableSwagger =
    configService.get<boolean>('app.enableSwagger') ?? false;
  const maxImageSize =
    configService.get<number>('storage.maxImageSizeBytes') ?? 10_485_760;
  const compressionEnabled =
    configService.get<boolean>('observability.compressionEnabled') === true;
  const trustProxy =
    configService.get<boolean>('observability.trustProxy') === true;
  const isProduction = nodeEnv === 'production';

  app.setGlobalPrefix(apiPrefix);

  if (trustProxy) {
    const expressApp = app.getHttpAdapter().getInstance() as {
      set: (setting: string, value: number) => void;
    };
    expressApp.set('trust proxy', 1);
  }

  if (compressionEnabled) {
    app.use(compression());
  }

  app.use(
    helmet({
      contentSecurityPolicy: isProduction ? undefined : false,
    }),
  );
  app.use(json({ limit: Math.max(maxImageSize, 1_048_576) }));
  app.use(
    urlencoded({ extended: true, limit: Math.max(maxImageSize, 1_048_576) }),
  );

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Requested-With',
      'Idempotency-Key',
    ],
    exposedHeaders: [
      'X-API-Version',
      'X-API-Deprecation',
      'X-API-Supported-Versions',
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.enableShutdownHooks();

  if (enableSwagger) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('FOLPS API')
      .setDescription(
        'REST API for Faith Of Life Protective Services (FOLPS) workforce management',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });

    logger.log(`Swagger available at /docs (environment: ${nodeEnv})`);
  } else {
    logger.log('Swagger is disabled for this environment');
  }

  // Bind all interfaces so Railway/Docker public networking can reach the process.
  await app.listen(port, '0.0.0.0');

  logger.log(`FOLPS API listening on 0.0.0.0:${port}`);
  logger.log(`Environment: ${nodeEnv}`);
  logger.log(`Global prefix: /${apiPrefix}`);
}

void bootstrap();
