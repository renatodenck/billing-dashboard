// Times/áreas para categorizar assinaturas. Fonte única usada pela API
// (validação) e pela tela (select). Sem dependências de servidor, então
// pode ser importado por componentes client.
export const TEAMS = ["Vendas", "Marketing", "IA", "Financeiro", "RH"] as const;
export type Team = (typeof TEAMS)[number];

export function isTeam(v: unknown): v is Team {
  return typeof v === "string" && (TEAMS as readonly string[]).includes(v);
}
