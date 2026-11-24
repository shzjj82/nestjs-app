import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ApiDoc, MQTT_GROUPS, MQTT_PATTERNS, sharePattern } from '@app/common';
import { OcrService } from './ocr.service';

@Controller()
export class OcrController {
  constructor(private readonly ocr: OcrService) {}

  @MessagePattern(sharePattern(MQTT_GROUPS.AGENTS, MQTT_PATTERNS.AGENTS_OCR))
  @ApiDoc({ name: '同步图片识别', description: '等待 qwen3.5-ocr 结果后一次返回' })
  recognize(payload: unknown) {
    return this.ocr.recognize(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.AGENTS, MQTT_PATTERNS.AGENTS_OCR_TASK_CREATE))
  @ApiDoc({ name: '异步图片识别', description: '立即返回任务号，完成后用查询接口取结果' })
  createTask(payload: unknown) {
    return this.ocr.createTask(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.AGENTS, MQTT_PATTERNS.AGENTS_OCR_TASK_FIND))
  @ApiDoc({ name: '查询图片识别任务' })
  findTask(payload: unknown) {
    return this.ocr.findTask(payload);
  }
}
