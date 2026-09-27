import { db } from "@/db";
import { users } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { jsonSuccess } from "@/lib/api-helpers";
import { initializeDatabase } from "@/db/seed";

export const dynamic = "force-dynamic";

/**
 * Liste des profils affichés sur l'écran d'accueil.
 * ?role=vendor (défaut) → vendeurs ; ?role=manager → gestionnaires.
 * Seuls le nom et le rôle sont exposés (jamais l'identifiant de connexion).
 */
export async function GET(req: Request) {
  await initializeDatabase();
  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role") === "manager" ? "manager" : "vendor";

  const rows = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      role: users.role,
    })
    .from(users)
    .where(and(eq(users.active, true), eq(users.role, role)))
    .orderBy(asc(users.fullName));

  return jsonSuccess(rows);
}
