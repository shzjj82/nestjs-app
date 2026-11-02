import { Injectable } from '@nestjs/common';
import { asRecord, optionalString, rpcFail } from '../common/rpc';
import { requireBizCode } from '../common/biz-scope';
import { MediaJobsService } from '../media/media-jobs.service';

@Injectable()
export class VideoService {
  constructor(private readonly jobs: MediaJobsService) {}

  async submit(payload: unknown) {
    const body = asRecord(payload);
    const bizCode = requireBizCode(payload);
    const accountId = optionalString(asRecord(body._session).accountId);
    const fileUrl = optionalString(body.fileUrl);
    if (!fileUrl) rpcFail(400, '请提供视频或长音频的 fileUrl');
    return this.jobs.submitTingwu({
      bizCode,
      accountId,
      kind: 'video',
      fileUrl,
      mime: optionalString(body.mime) ?? 'video/mp4',
    });
  }
}
