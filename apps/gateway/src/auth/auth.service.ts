import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { GatewayAuth } from '@app/common';
import { docsServiceKey, TokenStore } from '@app/common';
import type { Request } from 'express';
import type { GatewayUser } from './auth.types';

type AuthedRequest = Request & { user?: GatewayUser };

@Injectable()
export class AuthService {
  constructor(private readonly tokens: TokenStore) {}

  docsKey(req: Request): string | null {
    const header = req.headers['x-docs-key'];
    if (typeof header === 'string' && header.trim()) {
      return header.trim();
    }
    return null;
  }

  hasValidDocsKey(req: Request): boolean {
    const key = this.docsKey(req);
    return !!key && key === docsServiceKey();
  }

  bearerToken(req: Request): string | null {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return null;
    }
    const token = header.slice(7).trim();
    return token || null;
  }

  async fromRequest(req: Request): Promise<GatewayUser | null> {
    const token = this.bearerToken(req);
    if (!token) {
      return null;
    }
    const session = await this.tokens.get(token);
    if (!session) {
      return null;
    }
    return {
      id: session.userId,
      name: session.nickname,
      role: session.role,
      appId: session.appId,
      username: session.username,
      roles: session.roles,
      permissions: session.permissions,
      token,
    };
  }

  async enforce(
    auth: GatewayAuth[] | undefined,
    req: Request,
    permissions?: string[],
  ): Promise<GatewayUser | null> {
    const allowDocsKey = auth?.includes('docs-key');
    const allowJwt =
      auth?.includes('jwt') || auth?.includes('admin') || !!permissions?.length;

    if (allowDocsKey && allowJwt) {
      const keyOk = this.hasValidDocsKey(req);
      const user = await this.fromRequest(req);
      if (keyOk) {
        if (user) {
          (req as AuthedRequest).user = user;
        }
        return user;
      }
      if (user) {
        if (auth?.includes('admin') && !this.isAdmin(user)) {
          throw new ForbiddenException('需要管理员权限');
        }
        if (permissions?.length && !this.hasAnyPermission(user, permissions)) {
          throw new ForbiddenException(`缺少权限: ${permissions.join(', ')}`);
        }
        (req as AuthedRequest).user = user;
        return user;
      }
      throw new UnauthorizedException('需要登录或文档服务密钥：x-docs-key');
    }

    if (allowDocsKey) {
      if (!this.hasValidDocsKey(req)) {
        throw new UnauthorizedException('需要文档服务密钥：x-docs-key');
      }
      if (!allowJwt) {
        return null;
      }
    }

    if (!auth?.length && !permissions?.length) {
      return null;
    }

    const user = await this.fromRequest(req);
    if (!user) {
      throw new UnauthorizedException('需要登录：Authorization: Bearer <token>');
    }
    if (auth?.includes('admin') && !this.isAdmin(user)) {
      throw new ForbiddenException('需要管理员权限');
    }
    if (permissions?.length && !this.hasAnyPermission(user, permissions)) {
      throw new ForbiddenException(`缺少权限: ${permissions.join(', ')}`);
    }

    (req as AuthedRequest).user = user;
    return user;
  }

  isAdmin(user: GatewayUser): boolean {
    return user.role === 'admin' || user.roles.includes('admin');
  }

  hasAnyPermission(user: GatewayUser, codes: string[]): boolean {
    if (this.isAdmin(user)) {
      return true;
    }
    return codes.some((code) => user.permissions.includes(code));
  }
}
