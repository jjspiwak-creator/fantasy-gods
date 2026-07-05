import { pgTable, text, real, timestamp } from "drizzle-orm/pg-core";

export const playerProjectionsTable = pgTable("player_projections", {
  playerId: text("player_id").primaryKey(),
  playerName: text("player_name").notNull(),
  position: text("position").notNull(),
  proTeam: text("pro_team").notNull().default("FA"),
  rosProjection: real("ros_projection").notNull().default(0),
  weeklyProjection: real("weekly_projection").notNull().default(0),
  auctionValue: real("auction_value"),
  lastSyncedAt: timestamp("last_synced_at").defaultNow().notNull(),
});

export type PlayerProjection = typeof playerProjectionsTable.$inferSelect;
export type InsertPlayerProjection = typeof playerProjectionsTable.$inferInsert;
