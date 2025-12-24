import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // Compatibility: allow DB_URL to satisfy Prisma's DATABASE_URL (matching backend-v2)
  if (!process.env.DATABASE_URL && (process.env as any).DB_URL) {
    (process.env as any).DATABASE_URL = (process.env as any).DB_URL as string;
  }

  const app = await NestFactory.create(AppModule);

  // CORS configuration (matching backend-v2 lines 27-38)
  const allowedOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5174';
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (origin === allowedOrigin) return callback(null, true);
      if (/^http:\/\/localhost:517\d$/.test(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  // Set global prefix (matching backend-v2 /api prefix)
  app.setGlobalPrefix('api');

  const PORT = Number(process.env.PORT || process.env.BACKEND_PORT || 5002);
  await app.listen(PORT);
  console.log(`Backend listening on port ${PORT}`);
}
bootstrap();
