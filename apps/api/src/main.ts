import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { LoggerService } from './logger/logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(LoggerService);
  app.useLogger(logger);

  // Security headers
  app.use(helmet());

  // Prevent memory exhaustion / Denial-of-Service via huge payload attacks
  app.use(json({ limit: '5mb' }));
  app.use(urlencoded({ extended: true, limit: '5mb' }));

  // Cookie parsing for HttpOnly JWT tokens
  app.use(cookieParser());

  // Support both /api/... and direct /... endpoints seamlessly
  app.use((req: any, _res: any, next: any) => {
    if (req.url.startsWith('/api/')) {
      req.url = req.url.replace(/^\/api/, '');
    }
    next();
  });

  // Strict request validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS configuration supporting web app cookies & headers
  const corsOriginsStr = process.env.API_CORS_ORIGIN || process.env.CORS_ORIGIN;
  const allowedOrigins = [
    ...(corsOriginsStr
      ? corsOriginsStr.split(',').map((s) => s.trim())
      : ['http://localhost:5173']),
  ];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Session-Id',
      'Accept',
      'Origin',
      'X-Requested-With',
    ],
    exposedHeaders: ['Set-Cookie'],
  });

  const port = process.env.API_PORT ?? process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');

  logger.log(`API server is running on PORT : ${port}`, 'Bootstrap');
}

bootstrap();
