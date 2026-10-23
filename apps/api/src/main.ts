import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS if needed for web app integration
  app.enableCors();

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`API server is running on http://localhost:${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
}

bootstrap();
