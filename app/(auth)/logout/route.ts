import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { SESSION_COOKIE_NAME } from '@/lib/constants';
import { invalidateSession } from '@/lib/auth/sessions';

export async function POST(request: Request) {
  const store = await cookies();
  const sessionId = store.get(SESSION_COOKIE_NAME)?.value;
  if (sessionId) {
    await invalidateSession(sessionId);
  }
  // 303: el navegador convierte el POST en un GET a /login.
  return NextResponse.redirect(new URL('/login', request.url), 303);
}
