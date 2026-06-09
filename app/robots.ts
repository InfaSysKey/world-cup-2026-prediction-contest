import type { MetadataRoute } from 'next';

// La porra es privada (acceso solo por invitación). No queremos que ningún
// buscador la indexe, así que bloqueamos todo.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      disallow: '/',
    },
  };
}
