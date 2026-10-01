import { Module } from '@nestjs/common';
import { ApiDocsModule, MQTT_GROUPS, MQTT_PATTERNS, sharePattern } from '@app/common';
import { DatabaseModule } from './database/database.module';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

@Module({
  imports: [
    DatabaseModule,
    ApiDocsModule.forService({
      service: 'order',
      label: '订单模块',
      pattern: sharePattern(MQTT_GROUPS.ORDER, MQTT_PATTERNS.ORDER_API_DOCS),
    }),
  ],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule {}
