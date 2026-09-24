import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { TransformInterceptor } from './common/transform.interceptor';
import { GatewayModule } from './gateway.module';

async function bootstrap() {
  const app = await NestFactory.create(GatewayModule);
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  // Next.js / 博客只调 HTTP 网关；浏览器直连时需要 CORS，服务端 fetch 不受影响
  const origins = process.env.CORS_ORIGIN?.split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins?.length ? origins : true,
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type', 'x-docs-key'],
  });
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  Logger.log(`HTTP 入口已启动: http://0.0.0.0:${port}`, 'Gateway');
}

void bootstrap();
