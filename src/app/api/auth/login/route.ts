import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword, createSession, SESSION_COOKIE, SESSION_DURATION_DAYS, hashPassword } from "@/lib/auth";
import { initializeDatabase } from "@/db/seed";
import { z } from "zod";
import { jsonError } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    // Auto-init DB if first use
    await initializeDatabase();

    const body = await req.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Nom d'utilisateur et mot de passe requis", 400);
    }
    const { username, password } = parsed.data;

    // On first run, also allow setting admin password via 'setup' key
    const isSetup = body?.setup === true;

    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    // First-time setup: if admin is default password "admin", allow changing it
    if (isSetup && existing && existing.username === "admin") {
      const isDefaultPwd = await verifyPassword("admin", existing.passwordHash);
      if (isDefaultPwd) {
        const newHash = await hashPassword(password);
        await db
          .update(users)
          .set({ passwordHash: newHash, fullName: body.fullName || "Administrateur" })
          .where(eq(users.id, existing.id));
      }
    }

    if (!existing) {
      return jsonError("Nom d'utilisateur ou mot de passe incorrect", 401);
    }
    if (!existing.active) {
      return jsonError("Ce compte est désactivé", 403);
    }

    const ok = await verifyPassword(password, existing.passwordHash);
    if (!ok) {
      return jsonError("Nom d'utilisateur ou mot de passe incorrect", 401);
    }

    // Le bouton « Administrateur » de l'accueil n'accepte que les administrateurs.
    if (body?.portal === "admin" && existing.role !== "admin") {
      return jsonError(
        "Ce compte n'est pas administrateur. Utilisez le bouton Vendeur ou Gestionnaire.",
        403
      );
    }

    // Update last login
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, existing.id));

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    const token = await createSession(existing.id, ip, userAgent);

    const response = NextResponse.json({
      ok: true,
      data: {
        id: existing.id,
        username: existing.username,
        fullName: existing.fullName,
        role: existing.role,
        permissions: existing.permissions || [],
      },
    });

    response.cookies.set({
      name: SESSION_COOKIE,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    console.error("Login error:", error);
    return jsonError("Erreur lors de la connexion", 500);
  }
}
