import { NextResponse } from 'next/server';
import {
  ACCESS_COOKIE,
  BIZ_HEADER,
  REFRESH_COOKIE,
  adminBizCode,
  gatewayUnavailableResponse,
  gatewayUrl,
  readApiResponse,
} from '@/lib/api';
import { cookieOptions, isAdmin } from '@/lib/auth';

interface LoginResult {
  token: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
  user: {
    id: string;
    username: string | null;
    nickname: string;
    roles?: string[];
  };
}

export async function POST(req: Request) {
  const body = await req.json();
  let res: Response;
  try {
    res = await fetch(`${gatewayUrl()}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', [BIZ_HEADER]: adminBizCode() },
      body: JSON.stringify({
        username: body.username,
        password: body.password,
      }),
    });
  } catch {
    return gatewayUnavailableResponse();
  }
  const json = await readApiResponse<LoginResult>(res);
  if (!res.ok || !json.success || !json.data) {
    return NextResponse.json(
      { success: false, code: json.code || res.status, message: json.message || '登录失败', data: null },
      { status: res.status >= 400 ? res.status : 401 },
    );
  }

  if (!isAdmin(json.data.user)) {
    return NextResponse.json(
      {
        success: false,
        code: 403,
        message: '需要超级管理员（admin）角色才能进入控制台',
        data: null,
      },
      { status: 403 },
    );
  }

  const response = NextResponse.json({
    success: true,
    code: 200,
    message: 'ok',
    data: { user: json.data.user },
  });
  response.cookies.set(ACCESS_COOKIE, json.data.token, {
    ...cookieOptions,
    maxAge: json.data.expiresIn || 7200,
  });
  response.cookies.set(REFRESH_COOKIE, json.data.refreshToken, {
    ...cookieOptions,
    maxAge: json.data.refreshExpiresIn || 2592000,
  });
  return response;
}
