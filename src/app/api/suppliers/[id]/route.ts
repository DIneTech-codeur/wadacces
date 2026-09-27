import { db } from "@/db";
import { suppliers, purchases, products } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireUser, requireRole, jsonError, jsonSuccess } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("").transform(() => null)),
  notes: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser("supplier.view");
  if (error) return error;
  const { id } = await params;
  const sid = parseInt(id, 10);
  if (Number.isNaN(sid)) return jsonError("ID invalide");

  const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, sid)).limit(1);
  if (!supplier) return jsonError("Fournisseur introuvable", 404);

  return jsonSuccess(supplier);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser("supplier.create");
  if (error) return error;
  const { id } = await params;
  const sid = parseInt(id, 10);
  if (Number.isNaN(sid)) return jsonError("ID invalide");

  const [existing] = await db.select().from(suppliers).where(eq(suppliers.id, sid)).limit(1);
  if (!existing) return jsonError("Fournisseur introuvable", 404);

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Données invalides");

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.phone !== undefined) patch.phone = parsed.data.phone;
  if (parsed.data.company !== undefined) patch.company = parsed.data.company;
  if (parsed.data.address !== undefined) patch.address = parsed.data.address;
  if (parsed.data.email !== undefined) patch.email = parsed.data.email;
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes;
  if (typeof parsed.data.active === "boolean") patch.active = parsed.data.active;

  const [updated] = await db
    .update(suppliers)
    .set(patch)
    .where(eq(suppliers.id, sid))
    .returning();

  await writeAuditLog({
    user,
    action: "update",
    entityType: "supplier",
    entityId: sid,
    oldValues: existing,
    newValues: updated,
  });

  return jsonSuccess(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireRole("admin");
  if (error) return error;
  const { id } = await params;
  const sid = parseInt(id, 10);
  if (Number.isNaN(sid)) return jsonError("ID invalide");

  const [existing] = await db.select().from(suppliers).where(eq(suppliers.id, sid)).limit(1);
  if (!existing) return jsonError("Fournisseur introuvable", 404);

  const [hasPurchases] = await db.select({ c: sql<number>`count(*)` }).from(purchases).where(eq(purchases.supplierId, sid));
  const [hasProducts] = await db.select({ c: sql<number>`count(*)` }).from(products).where(eq(products.supplierId, sid));

  const count = Number(hasPurchases?.c ?? 0) + Number(hasProducts?.c ?? 0);

  if (count > 0 || Number(existing.debt) > 0) {
    await db.update(suppliers).set({ active: false, updatedAt: new Date() }).where(eq(suppliers.id, sid));
    await writeAuditLog({
      user,
      action: "deactivate",
      entityType: "supplier",
      entityId: sid,
      note: "Fournisseur désactivé (conservé dans l'historique)",
    });
    return jsonSuccess({ id: sid, deactivated: true, message: "Fournisseur désactivé (conservé dans l'historique)" });
  }

  await db.delete(suppliers).where(eq(suppliers.id, sid));
  await writeAuditLog({
    user,
    action: "delete",
    entityType: "supplier",
    entityId: sid,
    oldValues: existing,
  });

  return jsonSuccess({ id: sid, deleted: true, message: "Fournisseur supprimé" });
}
