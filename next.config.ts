import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Habilita forbidden()/unauthorized() para devolver 403/401 reales desde
  // Server Components (lib/auth/require-admin.ts).
  experimental: {
    authInterrupts: true,
  },
};

export default nextConfig;
