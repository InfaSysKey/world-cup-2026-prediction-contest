import Link from 'next/link';

export default function Forbidden() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">Acceso reservado</h1>
      <p className="text-zinc-600">Esta zona es solo para el administrador.</p>
      <Link href="/porra" className="text-sm font-medium underline">
        Volver a mi porra
      </Link>
    </div>
  );
}
