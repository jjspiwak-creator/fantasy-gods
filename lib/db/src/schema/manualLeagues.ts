import { pgTable, uuid, text, integer, jsonb, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const manualLeaguesTable = pgTable("manual_leagues", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  creatorUserId: uuid("creator_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  teamCount: integer("team_count").notNull(),
  rosterSlots: jsonb("roster_slots").notNull(),
  scoringBasics: jsonb("scoring_basics").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const manualTeamsTable = pgTable("manual_teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  leagueId: uuid("league_id").notNull().references(() => manualLeaguesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  ownerUserId: uuid("owner_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  ownerDeparted: boolean("owner_departed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("manual_teams_league_id_idx").on(table.leagueId),
]);

export const manualRosterPlayersTable = pgTable("manual_roster_players", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id").notNull().references(() => manualTeamsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: text("position").notNull(),
  realTeam: text("real_team"),
  byeWeek: integer("bye_week"),
  isStarter: boolean("is_starter").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("manual_roster_players_team_id_idx").on(table.teamId),
]);
