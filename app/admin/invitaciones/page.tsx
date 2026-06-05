import { InvitacionesForm } from './invitaciones-form';

export default function InvitacionesPage() {
  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Invitaciones</h1>
      <p className="text-sm text-zinc-600">
        Genera un enlace de un solo uso. Se muestra una vez: cópialo y envíalo.
      </p>
      <InvitacionesForm />
    </section>
  );
}
