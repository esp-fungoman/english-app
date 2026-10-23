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

let startupStage = 'security configuration';

// Only application-owned validation messages are safe to log. Library errors
// can contain connection URLs or credentials, so never print them verbatim.
function safeStartupDetail(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  const knownMessages = new Set([
    'Configure production admin credentials',
    'ADMIN_SESSION_SECRET must have at least 32 characters',
    'STUDENT_SESSION_SECRET must be at least 32 characters',
    'Admin and student secrets must differ',
    'RATE_LIMIT_SECRET must have at least 32 characters',
    'TRUSTED_PROXIES must contain explicit trusted IPs/CIDRs, never all-address networks',
    'Invalid REDIS_URL',
    'REDIS_URL is required in production',
    'Redis authentication is required in production',
  ]);
  if (
    knownMessages.has(message) ||
    /^(Configure|Invalid) (WEB_ORIGIN|ADMIN_ORIGIN)$/.test(message) ||
    /^Invalid RATE_LIMIT_[A-Z_]+$/.test(message)
  )
    return message;
  return 'Check configuration and service availability; error details withheld.';
}

async function bootstrap() {
  const config = securityConfig();
  startupStage = 'Redis configuration';
  const limiter = new RateLimiter(config.secret);
  startupStage = 'Nest application initialization';
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
  startupStage = 'database connection and HTTP listener';
  await app.listen(port);
  for (const signal of ['SIGTERM', 'SIGINT'] as const)
    process.once(signal, () => void limiter.close());
  Logger.log(`API listening on port ${port}`);
}
void bootstrap().catch((error: unknown) => {
  Logger.error(
    `API startup failed during ${startupStage}: ${safeStartupDetail(error)}`,
  );
  process.exitCode = 1;
});
