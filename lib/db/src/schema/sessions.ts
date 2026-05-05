import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const sessionsTable = pgTable("sessions", {
  id: text("id").primaryKey(),
  espnS2: text("espn_s2").notNull(),
  swid: text("swid").notNull(),
  username: text("username"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
