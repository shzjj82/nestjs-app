import { Injectable } from '@nestjs/common';
import { asRecord, optionalString, rpcFail } from '../common/rpc';
import { requireBizCode } from '../common/biz-scope';
import { MediaJobsService } from '../media/media-jobs.service';
import { transcribeQwen } from './qwen-asr';

@Injectable()
export class SpeechService {
  constructor(private readonly jobs: MediaJobsService) {}

  async transcribe(payload: unknown) {
    const body = asRecord(payload);
    const bizCode = requireBizCode(payload);
    const accountId = optionalString(asRecord(body._session).accountId);
    const audioBase64 = optionalString(body.audioBase64) ?? '';
    const fileUrl = optionalString(body.fileUrl);
    const mime = optionalString(body.mime) ?? '';
    const provider = (optionalString(body.provider) ?? 'auto').toLowerCase();

    if (provider === 'tingwu' || (fileUrl && !audioBase64) || isVideo(mime)) {
      if (!fileUrl) rpcFail(400, '长音频或视频请先上传后传入 fileUrl');
      return this.jobs.submitTingwu({
        bizCode,
        accountId,
        kind: isVideo(mime) ? 'video' : 'speech',
        fileUrl,
        mime,
      });
    }

    if (!audioBase64) rpcFail(400, '请提供录音内容');
    const transcript = await transcribeQwen({ audioBase64, mime: mime || 'audio/webm' });
    return { transcript, provider: 'qwen_asr' as const };
  }
}

function isVideo(mime: string): boolean {
  return mime.toLowerCase().startsWith('video/') && !mime.toLowerCase().includes('webm');
}
