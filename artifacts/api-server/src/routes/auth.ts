import { Router } from "express";
import { z } from "zod";
import { db, usersTable, savedTradesTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { signToken, verifyToken, hashPassword, comparePassword, extractToken } from "../lib/auth";
import { logger } from "../lib/logger";

const router = Router();

const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  sessionId: z.string().optional(),
});

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const UpdateSettingsBody = z.object({
  showLeagueWarnings: z.boolean().optional(),
  vibePreference: z.enum(["corporate", "the_boys", "coach_speak", "vegas_degenerate"]).optional(),
});

function serializeUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    showLeagueWarnings: user.showLeagueWarnings,
    vibePreference: user.vibePreference as "corporate" | "the_boys",
    createdAt: user.createdAt.toISOString(),
  };
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Valid email and a password of at least 8 characters are required." });
    return;
  }

  const { email, password } = parsed.data;

  try {
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()));

    if (existing) {
      res.status(409).json({ error: "An account with this email already exists." });
      return;
    }

    const passwordHash = await hashPassword(password);
    const [user] = await db
      .insert(usersTable)
      .values({ email: email.toLowerCase(), passwordHash, showLeagueWarnings: true })
      .returning();

    // Migrate guest-saved trades to the permanent account
    if (parsed.data.sessionId) {
      try {
        await db
          .update(savedTradesTable)
          .set({ userId: user.id })
          .where(
            and(
              eq(savedTradesTable.sessionId, parsed.data.sessionId),
              isNull(savedTradesTable.userId),
            ),
          );
      } catch (migrateErr) {
        logger.warn({ migrateErr }, "Guest trade migration failed — non-fatal, trades still visible via sessionId");
      }
    }

    const token = signToken({ userId: user.id, email: user.email });
    res.json({ token, user: serializeUser(user) });
  } catch (err) {
    logger.error({ err }, "Error during registration");
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  const { email, password } = parsed.data;

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()));

    if (!user) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const token = signToken({ userId: user.id, email: user.email });
    res.json({ token, user: serializeUser(user) });
  } catch (err) {
    logger.error({ err }, "Error during login");
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const token = extractToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Token is invalid or expired. Please sign in again." });
    return;
  }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    res.json(serializeUser(user));
  } catch (err) {
    logger.error({ err }, "Error fetching user profile");
    res.status(500).json({ error: "Could not load profile." });
  }
});

router.patch("/auth/settings", async (req, res): Promise<void> => {
  const token = extractToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Token is invalid or expired. Please sign in again." });
    return;
  }

  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid settings payload." });
    return;
  }

  const updates: Partial<{ showLeagueWarnings: boolean; vibePreference: string }> = {};
  if (parsed.data.showLeagueWarnings !== undefined) updates.showLeagueWarnings = parsed.data.showLeagueWarnings;
  if (parsed.data.vibePreference !== undefined) updates.vibePreference = parsed.data.vibePreference;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No settings provided to update." });
    return;
  }

  try {
    const [user] = await db
      .update(usersTable)
      .set(updates)
      .where(eq(usersTable.id, payload.userId))
      .returning();

    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    res.json(serializeUser(user));
  } catch (err) {
    logger.error({ err }, "Error updating user settings");
    res.status(500).json({ error: "Could not update settings." });
  }
});

export default router;
