import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-eyebrow">Porra Mundial 2026</p>
        <h1 className="text-display-l">Entrar</h1>
      </div>
      <LoginForm />
    </main>
  );
}
