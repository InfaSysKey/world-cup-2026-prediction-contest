import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Porra Mundial 2026</h1>
      <p className="max-w-md text-zinc-600">
        La porra del Mundial entre amigos. El acceso es solo por invitación.
      </p>
      <Link
        href="/login"
        className="rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
      >
        Entrar
      </Link>
    </div>
  );
}
