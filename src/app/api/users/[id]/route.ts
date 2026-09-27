import { db } from "@/db";
import { users, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireRole, jsonError, jsonSuccess } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { hashPassword } from "@/lib/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const optionalText = z.string().max(500).optional().nullable();

const updateSchema = z.object({
  username: z
    .string()
    .min(3, "L'identifiant doit contenir au moins 3 caractères")
    .max(100)
    .regex(/^[a-zA-Z0-9._-]+$/, "Identifiant : lettres, chiffres, point, tiret uniquement")
    .optional(),
  fullName: z.string().min(1, "Le nom complet est obligatoire").max(255).optional(),
  password: z.string().min(4, "Le mot de passe doit contenir au moins 4 caractères").optional().or(z.literal("")),
  pin: z.string().regex(/^\d{4}$/, "Le code PIN doit contenir exactement 4 chiffres").optional().or(z.literal("")),
  role: z.enum(["admin", "manager", "vendor"]).optional(),
  active: z.boolean().optional(),
  phone: optionalText,
  email: z.string().email("Adresse e-mail invalide").optional().nullable().or(z.literal("")),
  address: optionalText,
  notes: optionalText,
});

const PUBLIC_FIELDS = {
  id: users.id,
  username: users.username,
  fullName: users.fullName,
  phone: users.phone,
  email: users.email,
  address: users.address,
  notes: users.notes,
  role: users.role,
  active: users.active,
  lastLoginAt: users.lastLoginAt,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

/** Fiche complète d'un utilisateur (administrateur uniquement). */
export async function GET(_req: Request, { params }: Params) {
  const { error } = await requireRole("admin");
  if (error) return error;
  const uid = parseInt((await params).id, 10);
  if (Number.isNaN(uid)) return jsonError("ID invalide");

  const [row] = await db
    .select({ ...PUBLIC_FIELDS, hasPin: users.pinCode })
    .from(users)
    .where(eq(users.id, uid))
    .limit(1);
  if (!row) return jsonError("Utilisateur introuvable", 404);

  return jsonSuccess({ ...row, hasPin: !!row.hasPin });
}

/** Modification complète « de A à Z » (administrateur uniquement). */
export async function PUT(req: Request, { params }: Params) {
  const { user, error } = await requireRole("admin");
  if (error) return error;
  const uid = parseInt((await params).id, 10);
  if (Number.isNaN(uid)) return jsonError("ID invalide");

  const [existing] = await db.select().from(users).where(eq(users.id, uid)).limit(1);
  if (!existing) return jsonError("Utilisateur introuvable", 404);

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Données invalides");
  const data = parsed.data;

  if (user.id === uid) {
    if (data.role && data.role !== "admin") {
      return jsonError("Vous ne pouvez pas retirer votre propre rôle d'administrateur", 400);
    }
    if (data.active === false) {
      return jsonError("Vous ne pouvez pas désactiver votre propre compte administrateur", 400);
    }
  }

  const nextRole = data.role ?? existing.role;
  if (nextRole !== "admin" && !existing.pinCode && !data.pin) {
    return jsonError("Définissez un code PIN à 4 chiffres pour ce rôle", 400);
  }

  if (data.username && data.username !== existing.username) {
    const [clash] = await db.select({ id: users.id }).from(users).where(eq(users.username, data.username)).limit(1);
    if (clash) return jsonError("Ce nom d'utilisateur est déjà utilisé par un autre compte", 409);
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (data.username) patch.username = data.username;
  if (data.fullName) patch.fullName = data.fullName.trim();
  if (data.role) patch.role = data.role;
  if (typeof data.active === "boolean") patch.active = data.active;
  if (data.phone !== undefined) patch.phone = data.phone || null;
  if (data.email !== undefined) patch.email = data.email || null;
  if (data.address !== undefined) patch.address = data.address || null;
  if (data.notes !== undefined) patch.notes = data.notes || null;
  if (data.password) patch.passwordHash = await hashPassword(data.password);
  if (data.pin) patch.pinCode = await hashPassword(data.pin);

  const [updated] = await db.update(users).set(patch).where(eq(users.id, uid)).returning(PUBLIC_FIELDS);

  // Compte désactivé ou changement de rôle : on déconnecte immédiatement l'utilisateur.
  if (data.active === false || (data.role && data.role !== existing.role) || data.password || data.pin) {
    if (user.id !== uid) await db.delete(sessions).where(eq(sessions.userId, uid));
  }

  await writeAuditLog({
    user,
    action: "update",
    entityType: "user",
    entityId: uid,
    oldValues: {
      username: existing.username,
      fullName: existing.fullName,
      role: existing.role,
      active: existing.active,
      phone: existing.phone,
      email: existing.email,
    },
    newValues: {
      ...updated,
      passwordChanged: !!data.password,
      pinChanged: !!data.pin,
    },
  });

  return jsonSuccess(updated);
}

/**
 * Retirer un utilisateur (administrateur uniquement).
 * S'il a un historique (ventes, mouvements, journal…), le compte est désactivé
 * pour préserver la traçabilité ; sinon il est supprimé définitivement.
 */
export async function DELETE(_req: Request, { params }: Params) {
  const { user, error } = await requireRole("admin");
  if (error) return error;
  const uid = parseInt((await params).id, 10);
  if (Number.isNaN(uid)) return jsonError("ID invalide");

  if (user.id === uid) {
    return jsonError("Vous ne pouvez pas supprimer votre propre compte administrateur", 400);
  }

  const [existing] = await db.select().from(users).where(eq(users.id, uid)).limit(1);
  if (!existing) return jsonError("Utilisateur introuvable", 404);

  await db.delete(sessions).where(eq(sessions.userId, uid));

  try {
    await db.delete(users).where(eq(users.id, uid));
  } catch (err: unknown) {
    const e = err as { code?: string; cause?: { code?: string } };
    const code = e?.code ?? e?.cause?.code;
    if (code !== "23503") throw err;

    // Clé étrangère : l'utilisateur apparaît dans l'historique → désactivation.
    await db.update(users).set({ active: false, updatedAt: new Date() }).where(eq(users.id, uid));
    await writeAuditLog({
      user,
      action: "deactivate",
      entityType: "user",
      entityId: uid,
      note: "Compte désactivé : l'utilisateur possède un historique (ventes, mouvements…)",
    });
    return jsonSuccess({
      id: uid,
      deleted: false,
      deactivated: true,
      message: "Le compte a été désactivé : son historique (ventes, mouvements) est conservé.",
    });
  }

  await writeAuditLog({
    user,
    action: "delete",
    entityType: "user",
    entityId: uid,
    oldValues: { username: existing.username, fullName: existing.fullName, role: existing.role },
  });

  return jsonSuccess({ id: uid, deleted: true, message: "Utilisateur supprimé définitivement" });
}
