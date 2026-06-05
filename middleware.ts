import { NextResponse, type NextRequest } from 'next/server';

import { SESSION_COOKIE_NAME } from '@/lib/constants';
import { isPublicRoute } from '@/lib/auth/public-routes';

// Corre en runtime Edge: NO puede tocar la BD ni bcrypt. Solo comprueba la
// PRESENCIA de la cookie de sesión y redirige; la validación real (sesión viva,
// usuario, is_admin) vive en getCurrentUser()/requireAdmin() en runtime Node.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);
  if (!hasSession) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Protege todo salvo assets estáticos; isPublicRoute() afina dentro.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
