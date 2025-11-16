import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors();

  const port = process.env.PORT || 3002;
  await app.listen(port);
  console.log(`Test Agent service running on: http://localhost:${port}`);
}

bootstrap();
