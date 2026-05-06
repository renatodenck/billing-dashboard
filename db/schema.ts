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

export type Snapshot = typeof snapshots.$inferSelect;
export type DailySpend = typeof dailySpend.$inferSelect;
