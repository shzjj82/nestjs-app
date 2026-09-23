import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { GatewayAuth } from '@app/common';
import type { Request } from 'express';
import type { GatewayUser } from './auth.types';

const DEMO_TOKENS: Record<string, GatewayUser> = {
  demo: { id: 'demo-user', name: 'Demo User', role: 'user' },
  'demo-admin': { id: 'demo-admin', name: 'Demo Admin', role: 'admin' },
};

type AuthedRequest = Request & { user?: GatewayUser };

@Injectable()
export class AuthService {
  fromRequest(req: Request): GatewayUser | null {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return null;
    }
    return DEMO_TOKENS[header.slice(7).trim()] ?? null;
  }

  enforce(auth: GatewayAuth[] | undefined, req: Request): GatewayUser | null {
    if (!auth?.length) {
      return null;
    }

    const user = this.fromRequest(req);
    if (!user) {
      throw new UnauthorizedException(
        '需要登录：Authorization: Bearer demo 或 Bearer demo-admin',
      );
    }
    if (auth.includes('admin') && user.role !== 'admin') {
      throw new ForbiddenException('需要管理员权限');
    }

    (req as AuthedRequest).user = user;
    return user;
  }
}
