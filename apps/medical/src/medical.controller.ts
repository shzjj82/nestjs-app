import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import {
  ApiDoc,
  MQTT_GROUPS,
  MQTT_PATTERNS,
  serviceHealth,
  sharePattern,
} from '@app/common';

@Controller()
export class MedicalController {
  @MessagePattern(
    sharePattern(MQTT_GROUPS.MEDICAL, MQTT_PATTERNS.MEDICAL_HEALTH),
  )
  @ApiDoc({ name: '中医服务健康检查' })
  health() {
    return serviceHealth('medical', {
      ai: {
        provider:
          process.env.LLM_BASE_URL ??
          process.env.QWEN_BASE_URL ??
          process.env.DEEPSEEK_BASE_URL ??
          'https://dashscope.aliyuncs.com/compatible-mode/v1',
        configured: Boolean(
          process.env.LLM_API_KEY ??
            process.env.QWEN_API_KEY ??
            process.env.DEEPSEEK_API_KEY,
        ),
        asr: process.env.ASR_PROVIDER ?? 'none',
        vision: process.env.VISION_PROVIDER ?? 'none',
      },
    });
  }
}
