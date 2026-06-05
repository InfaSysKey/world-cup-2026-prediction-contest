// Rutas accesibles sin sesión (CLAUDE.md §6, lista blanca explícita). El
// middleware deja pasar estas; cualquier otra ruta protegida exige cookie.
export const PUBLIC_ROUTES = ['/', '/login', '/registro'] as const;

// Prefijos que nunca se protegen (assets internos de Next, healthcheck, etc.).
const PUBLIC_PREFIXES = ['/_next', '/favicon', '/api/health'];

export function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname as (typeof PUBLIC_ROUTES)[number])) {
    return true;
  }
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
