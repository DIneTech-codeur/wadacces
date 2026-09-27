import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyPassword, createSession, SESSION_COOKIE, SESSION_DURATION_DAYS } from "@/lib/auth";
import { initializeDatabase } from "@/db/seed";
import { jsonError } from "@/lib/api-helpers";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  userId: z.number().int().positive(),
  pin: z.string().min(4).max(8),
  // Porte d'entrée utilisée sur l'accueil : chaque porte n'accepte que son rôle.
  portal: z.enum(["vendor", "manager"]).optional(),
});

export async function POST(req: Request) {
  try {
    await initializeDatabase();
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError("Code incorrect", 400);

    const [existing] = await db.select().from(users).where(eq(users.id, parsed.data.userId)).limit(1);
    if (!existing || !existing.active) {
      return jsonError("Compte introuvable", 401);
    }
    if (existing.role === "admin") {
      return jsonError("Utilisez le bouton Administrateur", 403);
    }
    if (parsed.data.portal === "vendor" && existing.role !== "vendor") {
      return jsonError("Ce compte n'est pas un compte vendeur", 403);
    }
    if (parsed.data.portal === "manager" && existing.role !== "manager") {
      return jsonError("Ce compte n'est pas un compte gestionnaire", 403);
    }

    let ok = false;
    if (existing.pinCode) {
      ok = await verifyPassword(parsed.data.pin, existing.pinCode);
    }
    if (!ok) {
      ok = await verifyPassword(parsed.data.pin, existing.passwordHash);
    }
    if (!ok) return jsonError("Code incorrect", 401);

    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, existing.id));

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
  } catch (error) {
    console.error("PIN login error:", error);
    return jsonError("Erreur lors de la connexion", 500);
  }
}
