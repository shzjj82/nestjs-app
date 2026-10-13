import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC = ['/login', '/api/auth/login', '/api/auth/logout'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get('admin_access_token')?.value;

  if (!token) {
    if (pathname.startsWith('/api/proxy')) {
      return NextResponse.json(
        { success: false, code: 401, message: '未登录', data: null },
        { status: 401 },
      );
    }
    if (!pathname.startsWith('/api/')) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('from', pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
