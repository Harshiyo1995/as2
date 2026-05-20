import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // Turn on native application orchestration setups
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Safeguards lower-level message validation transformations
  });

  app.enableCors();

  const port = process.env.PORT || 8080;
  await app.listen(port);
  console.log(`AS2 Gateway running on port ${port}`);
}
bootstrap();