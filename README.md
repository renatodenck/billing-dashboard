# Billing Dashboard

Painel interno que mostra gastos da OpenAI e Meta Ads, atualizado 3x/dia (08h, 12h, 16h - Brasília).

## Stack

- Next.js 15 (App Router) + TypeScript
- Drizzle ORM + Neon Postgres (free tier)
- Recharts para gráficos
- Tailwind para estilo
- Vercel Cron para o agendamento
- Basic Auth no middleware

## Variáveis de ambiente

Copia `.env.example` para `.env` localmente. Em produção (Vercel), configura via dashboard.

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | String de conexão do Neon Postgres |
| `OPENAI_ADMIN_KEY` | Admin key da OpenAI com escopo Usage API Read |
| `META_ACCESS_TOKEN` | System User token com `ads_read` |
| `META_AD_ACCOUNT_ID` | ID da conta de anúncios (sem o prefixo `act_`) |
| `DASHBOARD_USER` | Usuário do basic auth |
| `DASHBOARD_PASSWORD` | Senha do basic auth |
| `CRON_SECRET` | String aleatória que protege o endpoint `/api/cron/refresh` |

## Setup

```bash
npm install
cp .env.example .env       # preencher com seus valores
npm run db:push            # cria as tabelas no Neon
npm run dev
```

Para popular dados manualmente (sem esperar o cron):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/refresh
```

## Deploy na Vercel

1. Faz push do repo no GitHub.
2. Em https://vercel.com/new, importa o repo.
3. Em **Environment Variables**, adiciona todas as do `.env.example`.
4. Deploy.
5. Depois do primeiro deploy, roda `npm run db:push` localmente apontando pra `DATABASE_URL` de produção (uma vez só).
6. Dispara o cron manualmente uma vez:
   ```bash
   curl -H "Authorization: Bearer <CRON_SECRET>" https://<seu-app>.vercel.app/api/cron/refresh
   ```

## Cron schedule

O agendamento é feito via **GitHub Actions** (em `.github/workflows/refresh.yml`), porque o plano Hobby da Vercel limita cron a 1x/dia.

Schedule: `0 11,15,19 * * *` UTC = 08:00, 12:00, 16:00 horário de Brasília (UTC-3).

Secrets necessários no repo GitHub (Settings → Secrets and variables → Actions):
- `DASHBOARD_URL`: URL pública da Vercel (ex: `https://billing-dashboard-xxxx.vercel.app`)
- `CRON_SECRET`: mesma string usada no env var da Vercel

Pode disparar manualmente: aba **Actions** do repo → workflow "Refresh billing snapshot" → **Run workflow**.

Se o horário de verão voltar, ajustar para `0 10,14,18`.
