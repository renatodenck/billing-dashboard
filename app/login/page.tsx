import { signIn } from "@/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-psa-bg px-6">
      <div className="w-full max-w-sm rounded-2xl border border-psa-line bg-white p-8 shadow-sm">
        <div className="flex items-center">
          <span className="font-display text-3xl font-extrabold tracking-tight text-psa-ink">PSA</span>
          <span className="ml-0.5 text-3xl font-extrabold leading-none text-psa-orange">!</span>
        </div>
        <h1 className="mt-6 text-xl font-semibold tracking-tight text-psa-ink">
          Custos de IA &amp; Mídia
        </h1>
        <p className="mt-1 text-sm text-psa-muted">
          Acesso restrito a contas <strong className="text-psa-ink">@profissionaissa.com</strong>.
        </p>

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error === "AccessDenied"
              ? "Essa conta não é @profissionaissa.com. Entre com o email da empresa."
              : "Não foi possível entrar. Tente novamente."}
          </div>
        )}

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
          className="mt-6"
        >
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-3 rounded-full border border-psa-line bg-white px-4 py-2.5 text-sm font-semibold text-psa-ink transition hover:border-psa-orange hover:text-psa-orange"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
              <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.22V7.04H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.04l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
            </svg>
            Entrar com Google
          </button>
        </form>
      </div>
    </div>
  );
}
