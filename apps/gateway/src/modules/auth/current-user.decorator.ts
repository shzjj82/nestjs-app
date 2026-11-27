import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { GatewayUser } from './auth.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): GatewayUser | undefined => {
    return ctx.switchToHttp().getRequest<{ user?: GatewayUser }>().user;
  },
);
