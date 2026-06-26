// Public, login-free template panels. Each entry exposes EXACTLY one template
// of one account at a fixed slug — the public endpoint only ever serves these,
// so opening a share link can never reach another template/account or the token.

export type SharedTemplate = {
  slug: string;
  accountKey: string;
  templateId: string;
  title: string;
  subtitle: string;
};

export const SHARED_TEMPLATES: SharedTemplate[] = [
  {
    slug: "50-palestras",
    accountKey: "tbs",
    templateId: "1557429125924021", // 50_ima
    title: "50 Palestras que podem mudar a sua vida",
    subtitle: "The Best Speaker Brasil · WhatsApp",
  },
];

export function getSharedTemplate(slug: string): SharedTemplate | null {
  return SHARED_TEMPLATES.find((s) => s.slug === slug) ?? null;
}
