import {
  db,
  usersTable,
  savedTradesTable,
  manualLeaguesTable,
  manualTeamsTable,
  sessionsTable,
} from "@workspace/db";
import { eq, isNotNull, and } from "drizzle-orm";

export async function deleteAccount(
  userId: string,
  sessionId: string | null,
): Promise<void> {
  await db.transaction(async (tx) => {
    // 1. De-identify manual teams owned by this user
    await tx
      .update(manualTeamsTable)
      .set({ ownerDeparted: true, ownerUserId: null })
      .where(eq(manualTeamsTable.ownerUserId, userId));

    // 2. Delete saved trades linked to the account
    await tx.delete(savedTradesTable).where(eq(savedTradesTable.userId, userId));

    // 3. If a session was presented, purge its saved trades and session row
    if (sessionId) {
      await tx
        .delete(savedTradesTable)
        .where(eq(savedTradesTable.sessionId, sessionId));
      await tx.delete(sessionsTable).where(eq(sessionsTable.id, sessionId));
    }

    // 4. Resolve leagues this user created
    const creatorLeagues = await tx
      .select()
      .from(manualLeaguesTable)
      .where(eq(manualLeaguesTable.creatorUserId, userId));

    for (const league of creatorLeagues) {
      const [claimedTeam] = await tx
        .select({ id: manualTeamsTable.id })
        .from(manualTeamsTable)
        .where(
          and(
            eq(manualTeamsTable.leagueId, league.id),
            isNotNull(manualTeamsTable.ownerUserId),
          ),
        );

      if (claimedTeam) {
        // Other members exist — de-identify creator only
        await tx
          .update(manualLeaguesTable)
          .set({ creatorUserId: null })
          .where(eq(manualLeaguesTable.id, league.id));
      } else {
        // No other members — delete league (cascades teams and rosters)
        await tx
          .delete(manualLeaguesTable)
          .where(eq(manualLeaguesTable.id, league.id));
      }
    }

    // 5. Delete the user row
    await tx.delete(usersTable).where(eq(usersTable.id, userId));
  });
}
