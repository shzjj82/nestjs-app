import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  gatewayUrl,
  type ApiResponse,
} from '@/lib/api';
import { cookieOptions } from '@/lib/auth';

async function refreshAccessToken(refreshToken: string): Promise<{
  token: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
} | null> {
  try {
    const res = await fetch(`${gatewayUrl()}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const json = (await res.json()) as ApiResponse<{
      token: string;
      refreshToken: string;
      expiresIn: number;
      refreshExpiresIn: number;
    }>;
    if (!res.ok || !json.success || !json.data) {
      return null;
    }
    return json.data;
  } catch {
    return null;
  }
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  return proxy(req, await ctx.params);
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  return proxy(req, await ctx.params);
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  return proxy(req, await ctx.params);
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  return proxy(req, await ctx.params);
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  return proxy(req, await ctx.params);
}

async function proxy(req: NextRequest, params: { path: string[] }) {
  const jar = await cookies();
  let access = jar.get(ACCESS_COOKIE)?.value;
  const refresh = jar.get(REFRESH_COOKIE)?.value;
  const path = `/${params.path.join('/')}${req.nextUrl.search}`;
  const contentType = req.headers.get('content-type') || '';
  const isMultipart = contentType.includes('multipart/form-data');
  const body =
    req.method === 'GET' || req.method === 'HEAD'
      ? undefined
      : isMultipart
        ? await req.arrayBuffer()
        : await req.text();

  const headers: Record<string, string> = {};
  if (access) {
    headers.Authorization = `Bearer ${access}`;
  }
  if (isMultipart) {
    headers['Content-Type'] = contentType;
  } else if (body) {
    headers['Content-Type'] = 'application/json';
  }

  let upstream = await fetch(`${gatewayUrl()}${path}`, {
    method: req.method,
    headers,
    body: body as BodyInit | undefined,
  });

  if (upstream.status === 401 && refresh) {
    const pair = await refreshAccessToken(refresh);
    if (pair) {
      access = pair.token;
      headers.Authorization = `Bearer ${access}`;
      upstream = await fetch(`${gatewayUrl()}${path}`, {
        method: req.method,
        headers,
        body: body as BodyInit | undefined,
      });
      const response = new NextResponse(upstream.body, {
        status: upstream.status,
        headers: {
          'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
        },
      });
      response.cookies.set(ACCESS_COOKIE, pair.token, {
        ...cookieOptions,
        maxAge: pair.expiresIn || 7200,
      });
      response.cookies.set(REFRESH_COOKIE, pair.refreshToken, {
        ...cookieOptions,
        maxAge: pair.refreshExpiresIn || 2592000,
      });
      return response;
    }
  }

  const responseHeaders = new Headers();
  const ct = upstream.headers.get('Content-Type');
  if (ct) {
    responseHeaders.set('Content-Type', ct);
  }
  const cd = upstream.headers.get('Content-Disposition');
  if (cd) {
    responseHeaders.set('Content-Disposition', cd);
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
