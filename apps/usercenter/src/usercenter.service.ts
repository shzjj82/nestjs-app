import { Injectable } from '@nestjs/common';

@Injectable()
export class UsercenterService {
  health() {
    return { status: 'ok' };
  }
}
