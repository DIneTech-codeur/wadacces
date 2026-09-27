import { db } from "@/db";
import { customers, sales } from "@/db/schema";
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
  type: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser("customer.view");
  if (error) return error;
  const { id } = await params;
  const cid = parseInt(id, 10);
  if (Number.isNaN(cid)) return jsonError("ID invalide");

  const [customer] = await db.select().from(customers).where(eq(customers.id, cid)).limit(1);
  if (!customer) return jsonError("Client introuvable", 404);

  return jsonSuccess(customer);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireRole("admin", "manager");
  if (error) return error;
  const { id } = await params;
  const cid = parseInt(id, 10);
  if (Number.isNaN(cid)) return jsonError("ID invalide");

  const [existing] = await db.select().from(customers).where(eq(customers.id, cid)).limit(1);
  if (!existing) return jsonError("Client introuvable", 404);

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Données invalides");

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.phone !== undefined) patch.phone = parsed.data.phone;
  if (parsed.data.company !== undefined) patch.company = parsed.data.company;
  if (parsed.data.address !== undefined) patch.address = parsed.data.address;
  if (parsed.data.email !== undefined) patch.email = parsed.data.email;
  if (parsed.data.type !== undefined) patch.type = parsed.data.type;
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes;
  if (typeof parsed.data.active === "boolean") patch.active = parsed.data.active;

  const [updated] = await db
    .update(customers)
    .set(patch)
    .where(eq(customers.id, cid))
    .returning();

  await writeAuditLog({
    user,
    action: "update",
    entityType: "customer",
    entityId: cid,
    oldValues: existing,
    newValues: updated,
  });

  return jsonSuccess(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireRole("admin");
  if (error) return error;
  const { id } = await params;
  const cid = parseInt(id, 10);
  if (Number.isNaN(cid)) return jsonError("ID invalide");

  const [existing] = await db.select().from(customers).where(eq(customers.id, cid)).limit(1);
  if (!existing) return jsonError("Client introuvable", 404);

  // Check if client has sales
  const [hasSales] = await db.select({ c: sql<number>`count(*)` }).from(sales).where(eq(sales.customerId, cid));
  const salesCount = Number(hasSales?.c ?? 0);

  if (salesCount > 0 || Number(existing.debt) > 0) {
    // Preserve history integrity
    await db.update(customers).set({ active: false, updatedAt: new Date() }).where(eq(customers.id, cid));
    await writeAuditLog({
      user,
      action: "deactivate",
      entityType: "customer",
      entityId: cid,
      note: "Client désactivé (conservé dans l'historique des ventes)",
    });
    return jsonSuccess({ id: cid, deactivated: true, message: "Client désactivé (conservé dans l'historique)" });
  }

  await db.delete(customers).where(eq(customers.id, cid));
  await writeAuditLog({
    user,
    action: "delete",
    entityType: "customer",
    entityId: cid,
    oldValues: existing,
  });

  return jsonSuccess({ id: cid, deleted: true, message: "Client supprimé" });
}
