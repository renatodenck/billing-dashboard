import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// Só contas deste domínio podem entrar no painel.
const ALLOWED_DOMAIN = "profissionaissa.com";

function emailAllowed(email: unknown, emailVerified: unknown): boolean {
  return (
    typeof email === "string" &&
    email.toLowerCase().endsWith("@" + ALLOWED_DOMAIN) &&
    emailVerified === true
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      // `hd` já filtra a tela de escolha de conta do Google para o domínio;
      // a checagem real de segurança é o callback signIn abaixo.
      authorization: {
        params: { hd: ALLOWED_DOMAIN, prompt: "select_account" },
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    // Barreira de verdade: recusa qualquer login fora do domínio.
    async signIn({ profile }) {
      return emailAllowed(profile?.email, profile?.email_verified);
    },
    // Usado pelo middleware (proxy.ts): sessão válida = acesso liberado.
    authorized({ auth }) {
      return emailAllowed(auth?.user?.email, true);
    },
  },
});
