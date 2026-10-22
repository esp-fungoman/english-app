import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app/app.module';
import {
  requestSecurity,
  SafeExceptionFilter,
  securityConfig,
} from './security/http-security';
import { RateLimiter } from './security/rate-limit';

async function bootstrap() {
  const config = securityConfig();
  const limiter = new RateLimiter(config.secret);
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  app.set('case sensitive routing', true);
  app.set('trust proxy', config.proxy);
  app.disable('x-powered-by');
  app.setGlobalPrefix('api');
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.enableCors({
    origin: [config.web, config.admin],
    credentials: true,
    allowedHeaders: ['Content-Type', 'X-App-Request'],
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['Retry-After', 'X-Request-Id'],
  });
  app.use(cookieParser(config.studentSecret));
  app.useBodyParser('json', { limit: '256kb' });
  app.use(requestSecurity(config, limiter));
  app.useGlobalFilters(new SafeExceptionFilter());
  app.enableShutdownHooks();
  const port = process.env.PORT || 3333;
  await app.listen(port);
  for (const signal of ['SIGTERM', 'SIGINT'] as const)
    process.once(signal, () => void limiter.close());
  Logger.log(`API listening on port ${port}`);
}
void bootstrap().catch(() => {
  Logger.error(
    'API startup failed. Check required configuration and service availability.',
  );
  process.exitCode = 1;
});
