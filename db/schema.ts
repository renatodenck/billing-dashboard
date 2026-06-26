import { pgTable, serial, text, timestamp, numeric, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";

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

export type Snapshot = typeof snapshots.$inferSelect;
export type DailySpend = typeof dailySpend.$inferSelect;
export type PageClick = typeof pageClicks.$inferSelect;
