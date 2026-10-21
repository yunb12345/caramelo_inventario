import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { Lock, Mail, Shirt } from "lucide-react";
import { Button, Field, Input } from "../components/ui";
import { useAuth } from "../lib/auth";
import { errorMessage } from "../lib/utils";

export default function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login(email, password);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-brand-800 p-10 text-white lg:flex">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-600/40 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-lg font-bold">
            C
          </div>
          <div>
            <p className="text-sm font-semibold">Caramelo</p>
            <p className="text-xs text-brand-200">Inventario y ventas</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-3xl font-semibold leading-tight">
            Todo tu local de ropa, ordenado en un solo lugar.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-brand-100">
            Controla stock por talle y color, registra ventas en segundos y entérate al
            instante que hay que reponer.
          </p>

          <div className="mt-8 flex items-center gap-3 rounded-2xl bg-white/10 p-4 text-sm">
            <Shirt className="h-5 w-5 shrink-0 text-brand-200" />
            <p className="text-brand-50">
              Variantes por talle y color, codigos de barra y alertas de stock minimo.
            </p>
          </div>
        </div>

        <p className="relative text-xs text-brand-300">
          Caramelo · Sistema interno de gestion
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
              C
            </div>
            <h1 className="text-xl font-semibold text-stone-900">Caramelo</h1>
            <p className="text-sm text-stone-500">Inventario y ventas</p>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-stone-900">
            Iniciar sesion
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Ingresa con tu usuario para administrar el local.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Field label="Email">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <Input
                  type="email"
                  autoComplete="username"
                  placeholder="admin@caramelo.local"
                  className="pl-9"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoFocus
                />
              </div>
            </Field>

            <Field label="Contrasena">
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <Input
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pl-9"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
            </Field>

            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full" size="lg">
              Entrar
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-stone-400">
            Las credenciales iniciales estan definidas en{" "}
            <code className="rounded bg-stone-100 px-1 py-0.5">apps/api/.env</code>
          </p>
        </div>
      </div>
    </div>
  );
}
