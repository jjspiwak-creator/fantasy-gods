import { pgTable, serial, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const savedTradesTable = pgTable("saved_trades", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  leagueId: text("league_id").notNull(),
  name: text("name").notNull(),
  result: jsonb("result").notNull(),
  participants: jsonb("participants").notNull().default([]),
  lastRefreshedAt: timestamp("last_refreshed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSavedTradeSchema = createInsertSchema(savedTradesTable).omit({ id: true, createdAt: true });
export type InsertSavedTrade = z.infer<typeof insertSavedTradeSchema>;
export type SavedTrade = typeof savedTradesTable.$inferSelect;
