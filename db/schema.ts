import { pgTable, serial, text, timestamp, numeric, jsonb, integer, index, uniqueIndex } from "drizzle-orm/pg-core";

export const snapshots = pgTable(
  "snapshots",
  {
    id: serial("id").primaryKey(),
    source: text("source").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
    currency: text("currency").notNull(),
    totalSpent: numeric("total_spent", { precision: 14, scale: 4 }).notNull(),
    spentToday: numeric("spent_today", { precision: 14, scale: 4 }),
    spentMonth: numeric("spent_month", { precision: 14, scale: 4 }),
    balance: numeric("balance", { precision: 14, scale: 4 }),
    raw: jsonb("raw"),
  },
  (table) => ({
    sourceIdx: index("snapshots_source_idx").on(table.source),
    capturedAtIdx: index("snapshots_captured_at_idx").on(table.capturedAt),
  })
);

export const dailySpend = pgTable(
  "daily_spend",
  {
    id: serial("id").primaryKey(),
    source: text("source").notNull(),
    day: text("day").notNull(),
    currency: text("currency").notNull(),
    amount: numeric("amount", { precision: 14, scale: 4 }).notNull(),
    // Parcela de `amount` que é uso de modelo (tokens). O restante
    // (amount - tokensAmount) é "outros custos": web search, code execution,
    // storage, imagens, áudio. Nulo para fontes sem essa quebra (WhatsApp,
    // HubSpot) e para linhas antigas anteriores a esta coluna.
    tokensAmount: numeric("tokens_amount", { precision: 14, scale: 4 }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sourceDayIdx: uniqueIndex("daily_spend_source_day_idx").on(table.source, table.day),
  })
);

export const pageClicks = pgTable(
  "page_clicks",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    device: text("device").notNull(), // 'desktop' | 'mobile'
    xRatio: numeric("x_ratio", { precision: 6, scale: 5 }).notNull(),
    yRatio: numeric("y_ratio", { precision: 6, scale: 5 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugDeviceIdx: index("page_clicks_slug_device_idx").on(table.slug, table.device),
  })
);

// Generic key/value cache (e.g. rate-limited external APIs like Clarity).
export const kvCache = pgTable("kv_cache", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Assinaturas por assento (ChatGPT Team, Claude Team etc.) — custo que NÃO vem
// de nenhuma API de uso; cadastrado manualmente pela tela /assinaturas.
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  tool: text("tool").notNull(),
  // Time/área responsável (Vendas, Marketing, IA, Financeiro, RH). Nulo = sem time.
  team: text("team"),
  costPerSeat: numeric("cost_per_seat", { precision: 14, scale: 4 }).notNull(),
  seats: integer("seats").notNull().default(1),
  currency: text("currency").notNull().default("USD"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Snapshot = typeof snapshots.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type DailySpend = typeof dailySpend.$inferSelect;
export type PageClick = typeof pageClicks.$inferSelect;
