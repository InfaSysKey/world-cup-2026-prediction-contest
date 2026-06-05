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
        <h1 className="text-2xl font-semibold">Invitación necesaria</h1>
        <p className="text-zinc-600">
          El registro es solo por invitación. Pide al organizador tu enlace.
        </p>
        <Link href="/login" className="text-sm font-medium underline">
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
