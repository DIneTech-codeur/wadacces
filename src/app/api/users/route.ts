import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireRole, jsonError, jsonSuccess } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { hashPassword } from "@/lib/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** Liste des comptes (administrateur uniquement). */
export async function GET() {
  const { error } = await requireRole("admin");
  if (error) return error;

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      phone: users.phone,
      email: users.email,
      role: users.role,
      active: users.active,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.fullName));

  return jsonSuccess(rows);
}

const optionalText = z.string().max(500).optional().nullable();

const createSchema = z
  .object({
    username: z
      .string()
      .min(3, "L'identifiant doit contenir au moins 3 caractères")
      .max(100)
      .regex(/^[a-zA-Z0-9._-]+$/, "Identifiant : lettres, chiffres, point, tiret uniquement"),
    fullName: z.string().min(1, "Le nom complet est obligatoire").max(255),
    role: z.enum(["admin", "manager", "vendor"]).default("vendor"),
    password: z.string().min(4, "Le mot de passe doit contenir au moins 4 caractères").optional().or(z.literal("")),
    pin: z.string().regex(/^\d{4}$/, "Le code PIN doit contenir exactement 4 chiffres").optional().or(z.literal("")),
    phone: optionalText,
    email: z.string().email("Adresse e-mail invalide").optional().nullable().or(z.literal("")),
    address: optionalText,
    notes: optionalText,
    active: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.role === "admin" && !data.password) {
      ctx.addIssue({ code: "custom", message: "Un mot de passe est obligatoire pour un administrateur", path: ["password"] });
    }
    if (data.role !== "admin" && !data.pin) {
      ctx.addIssue({ code: "custom", message: "Un code PIN à 4 chiffres est obligatoire pour ce rôle", path: ["pin"] });
    }
  });

/** Création d'un compte (administrateur uniquement). */
export async function POST(req: Request) {
  const { user, error } = await requireRole("admin");
  if (error) return error;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message || "Données invalides");
  }
  const data = parsed.data;

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, data.username))
    .limit(1);
  if (existing) {
    return jsonError("Ce nom d'utilisateur existe déjà", 409);
  }

  const pinCode = data.pin ? await hashPassword(data.pin) : null;
  // Pour vendeur et gestionnaire, le mot de passe est facultatif : à défaut,
  // le code PIN sert aussi de mot de passe.
  const passwordHash = data.password ? await hashPassword(data.password) : (pinCode as string);

  const [created] = await db
    .insert(users)
    .values({
      username: data.username,
      fullName: data.fullName.trim(),
      passwordHash,
      pinCode,
      role: data.role,
      active: data.active,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      notes: data.notes || null,
      permissions: [],
    })
    .returning({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      role: users.role,
      active: users.active,
    });

  await writeAuditLog({
    user,
    action: "create",
    entityType: "user",
    entityId: created.id,
    newValues: created,
  });

  return jsonSuccess(created);
}
