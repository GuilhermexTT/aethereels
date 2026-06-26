import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const token = request.cookies.get('sb-access-token')?.value || request.cookies.get('supabase-auth-token')?.value;
  const { pathname } = request.nextUrl;

  // List of protected routes prefixes
  // We only protect routes that require authentication from the start.
  // /dashboard and /dashboard/auto-edicao are open (Value First strategy).
  const isProtectedRoute =
    pathname.startsWith('/history') ||
    pathname.startsWith('/dashboard/projetos');

  if (isProtectedRoute && !token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();

  // Define Content-Security-Policy header
  const cspValue = "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval' blob:; connect-src *; img-src * data: blob:; frame-src *; style-src * 'unsafe-inline';";
  
  response.headers.set('Content-Security-Policy', cspValue);
  
  return response;
}

// Configuração do Matcher para aplicar em todas as páginas do dashboard e editor
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
