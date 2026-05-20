import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getHealth(): { status: string, timestamp: Date } {
    return {
      status: 'AS2 Gateway Engine is running',
      timestamp: new Date()
    };
  }
}
