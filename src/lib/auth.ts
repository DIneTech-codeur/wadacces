import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";

const SECRET_KEY = process.env.AUTH_SECRET || "change-me-in-production-please-set-env";
const secret = new TextEncoder().encode(SECRET_KEY);

export const SESSION_COOKIE = "session_token";
export const SESSION_DURATION_DAYS = 30;

export interface SessionUser {
  id: number;
  username: string;
  fullName: string;
  role: "admin" | "manager" | "vendor";
  permissions: string[];
  active: boolean;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(userId: number): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_DAYS}d`)
    .sign(secret);
}

export async function verifySessionToken(
  token: string
): Promise<{ userId: number } | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (typeof payload.userId === "number") {
      return { userId: payload.userId };
    }
    return null;
  } catch {
    return null;
  }
}

export async function createSession(
  userId: number,
  ip?: string,
  userAgent?: string
): Promise<string> {
  const token = await createSessionToken(userId);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  await db.insert(sessions).values({
    token,
    userId,
    expiresAt,
    ipAddress: ip,
    userAgent,
  });

  return token;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const verified = await verifySessionToken(token);
    if (!verified) return null;

    // Also verify session exists in DB and not expired
    const [session] = await db
      .select({
        id: sessions.id,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.token, token),
          gt(sessions.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!session) return null;

    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        role: users.role,
        permissions: users.permissions,
        active: users.active,
      })
      .from(users)
      .where(eq(users.id, verified.userId))
      .limit(1);

    if (!user || !user.active) return null;

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role as SessionUser["role"],
      permissions: (user.permissions as string[]) || [],
      active: user.active,
    };
  } catch {
    return null;
  }
}

export async function logoutUser(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, token));
}

export function can(
  user: SessionUser | null,
  action: string
): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role === "manager") return true; // manager has most permissions
  // vendors can do specific things
  const vendorAllowed = [
    "sale.create",
    "sale.view",
    "product.view",
    "stock.view",
    "customer.view",
    "customer.create",
    "purchase.view",
    "purchase.create",
    "sync.access",
  ];
  return vendorAllowed.includes(action) || user.permissions.includes(action);
}

export async function ensureUser(requiredPermission?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const error = new Error("Non authentifié");
    (error as any).status = 401;
    throw error;
  }
  if (requiredPermission && !can(user, requiredPermission)) {
    const error = new Error("Permission refusée");
    (error as any).status = 403;
    throw error;
  }
  return user;
}
