// Public, login-free template panels. Each entry exposes EXACTLY one template
// of one account at a fixed slug — the public endpoint only ever serves these,
// so opening a share link can never reach another template/account or the token.

export type DealsConfig = {
  pipelineId: string;
  productProperty: string;
  productValue: string;
  amountProperty: string;
  paymentDateProperty: string;
  stages: { closed: string; abandoned: string; waiting: string; lost: string };
  /** Deal IDs to ignore in the funnel (e.g. internal test purchases). */
  excludeDealIds?: string[];
};

export type SharedTemplate = {
  slug: string;
  accountKey: string;
  templateId: string;
  title: string;
  subtitle: string;
  /** Optional HubSpot deals funnel for the same product. */
  deals?: DealsConfig;
  /** Microsoft Clarity project ID for the landing-page tab (heatmap link + metrics). */
  clarityProjectId?: string;
};

export const SHARED_TEMPLATES: SharedTemplate[] = [
  {
    slug: "50-palestras",
    accountKey: "tbs",
    templateId: "1557429125924021", // 50_ima
    title: "50 Palestras que podem mudar a sua vida",
    subtitle: "The Best Speaker Brasil · WhatsApp",
    deals: {
      pipelineId: "904543067", // The Best School | B2C
      productProperty: "tbschool__produto_de_interesse",
      productValue: "As 50 palestras mais bem avaliadas da PSA",
      amountProperty: "tbschool__valor_da_compra",
      paymentDateProperty: "tbschool__data_do_pagamento",
      stages: {
        closed: "1372708683", // Negócio fechado
        abandoned: "1372708678", // Abandonou Carrinho
        waiting: "1372708679", // Aguardando Pagamento
        lost: "1372708684", // Negócio perdido
      },
      excludeDealIds: [
        "61560794636", // "Marcio" — venda de teste (R$ 20,69)
        "61651362152", // "teste kiwify" — abandono de teste
      ],
    },
    clarityProjectId: "xd5svsofi5",
  },
];

export function getSharedTemplate(slug: string): SharedTemplate | null {
  return SHARED_TEMPLATES.find((s) => s.slug === slug) ?? null;
}
