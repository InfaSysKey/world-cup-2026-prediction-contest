import Link from 'next/link';

import { RegistroForm } from './registro-form';

export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-eyebrow">Porra Mundial 2026</p>
        <h1 className="text-display-l">Necesitas una invitación</h1>
        <p className="text-ink-muted">
          El álbum es solo por invitación. Pide al organizador tu enlace para
          abrir tu primer sobre.
        </p>
        <Link
          href="/login"
          className="text-sm font-medium text-cromo-cobalt underline"
        >
          Ya tengo cuenta
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Crear cuenta</h1>
      <RegistroForm token={token} />
    </main>
  );
}
