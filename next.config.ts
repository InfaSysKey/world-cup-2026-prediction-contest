import type { NextConfig } from 'next';

// CSP funcional para Next App Router. Next inyecta scripts inline de bootstrap
// e hidratación, por eso 'unsafe-inline' en script-src (sin nonce middleware
// rompería la app). 'unsafe-eval' solo en dev (lo necesita el HMR/react-refresh);
// en producción se omite. La app es privada, no carga recursos de terceros.
const isDev = process.env.NODE_ENV !== 'production';

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
]
  .join('; ')
  .concat(';');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // HSTS lo emite la app (no Plesk). Defensa en profundidad: aunque la
  // configuración de Plesk perdiera el header, sigue viajando con la respuesta.
  // Los navegadores solo lo honran sobre HTTPS, así que en local (http) es no-op.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig: NextConfig = {
  // Habilita forbidden()/unauthorized() para devolver 403/401 reales desde
  // Server Components (lib/auth/require-admin.ts).
  experimental: {
    authInterrupts: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
