import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, REFRESH_COOKIE, gatewayUrl } from '@/lib/api';
import { cookies } from 'next/headers';

export async function POST() {
  const jar = await cookies();
  const token = jar.get(ACCESS_COOKIE)?.value;
  if (token) {
    try {
      await fetch(`${gatewayUrl()}/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      });
    } catch {
      // ignore
    }
  }
  const response = NextResponse.json({
    success: true,
    code: 200,
    message: 'ok',
    data: { ok: true },
  });
  response.cookies.set(ACCESS_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}
