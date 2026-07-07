// Middleware do Next 16 (proxy). Protege o painel com login Google (Auth.js),
// restrito ao domínio @profissionaissa.com (ver auth.ts). Rotas fora do matcher
// abaixo ficam liberadas: o cron (usa CRON_SECRET), páginas públicas de share,
// os endpoints do próprio Auth.js e a tela de login.
export { auth as proxy } from "@/auth";

export const config = {
  matcher: [
    "/((?!api/auth|login|api/cron|api/public|api/share-login|api/zone|share|_next/static|_next/image|favicon.ico).*)",
  ],
};
