import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { logger } from "./logger";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-tradesim-change-in-prod";
const BCRYPT_ROUNDS = 10;

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  logger.error("JWT_SECRET env var is not set in production — this is a critical security issue");
}

export interface JwtPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

export function signToken(payload: Omit<JwtPayload, "iat" | "exp">): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Extract Bearer token from Authorization header, returns null if absent/malformed. */
export function extractToken(authHeader?: string): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
}
