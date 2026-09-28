import { Injectable } from '@nestjs/common';
import { serviceHealth } from '@app/common';

@Injectable()
export class UsercenterService {
  health() {
    return serviceHealth('usercenter');
  }
}
