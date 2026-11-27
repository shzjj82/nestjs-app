import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ApiDoc, MQTT_GROUPS, MQTT_PATTERNS, sharePattern } from '@app/common';
import { WikiOcrService } from './ocr.service';

@Controller()
export class WikiOcrController {
  constructor(private readonly ocr: WikiOcrService) {}

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AGENTS_OCR))
  @ApiDoc({ name: 'Wiki 同步图片识别' })
  recognize(payload: Record<string, unknown>) {
    return this.ocr.recognize(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AGENTS_OCR_TASK_CREATE))
  @ApiDoc({ name: 'Wiki 异步图片识别' })
  createTask(payload: Record<string, unknown>) {
    return this.ocr.createTask(payload);
  }

  @MessagePattern(sharePattern(MQTT_GROUPS.WIKI, MQTT_PATTERNS.WIKI_AGENTS_OCR_TASK_FIND))
  @ApiDoc({ name: 'Wiki 查询图片识别任务' })
  findTask(payload: Record<string, unknown>) {
    return this.ocr.findTask(payload);
  }
}
