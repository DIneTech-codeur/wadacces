import { NextResponse } from "next/server";
import { db } from "@/db";
import { products } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireUser, requireRole, jsonError, jsonSuccess } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  sku: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  categoryId: z.number().int().positive().optional().nullable(),
  supplierId: z.number().int().positive().optional().nullable(),
  brand: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  compatibility: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  purchasePrice: z.number().nonnegative().optional(),
  retailPrice: z.number().nonnegative().optional(),
  wholesalePrice: z.number().nonnegative().optional(),
  specialPrice: z.number().nonnegative().optional().nullable(),
  promotionalPrice: z.number().nonnegative().optional().nullable(),
  minStock: z.number().int().nonnegative().optional(),
  location: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

async function getProduct(id: number) {
  return db
    .select()
    .from(products)
    .where(and(eq(products.id, id), isNull(products.deletedAt)))
    .limit(1);
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser("product.view");
  if (error) return error;
  const { id } = await params;
  const pid = parseInt(id, 10);
  if (isNaN(pid)) return jsonError("ID invalide", 400);

  const [product] = await getProduct(pid);
  if (!product) return jsonError("Produit introuvable", 404);
  return jsonSuccess(product);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser("product.edit");
  if (error) return error;
  const { id } = await params;
  const pid = parseInt(id, 10);
  if (isNaN(pid)) return jsonError("ID invalide", 400);

  const [existing] = await getProduct(pid);
  if (!existing) return jsonError("Produit introuvable", 404);

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message || "Données invalides");
  }

  const updateData: any = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v === undefined) continue;
    if (["purchasePrice", "retailPrice", "wholesalePrice", "specialPrice", "promotionalPrice"].includes(k)) {
      updateData[k] = v === null ? null : String(v);
    } else {
      updateData[k] = v;
    }
  }

  const [updated] = await db
    .update(products)
    .set(updateData)
    .where(eq(products.id, pid))
    .returning();

  await writeAuditLog({
    user,
    action: "update",
    entityType: "product",
    entityId: pid,
    oldValues: existing,
    newValues: updated,
  });

  return jsonSuccess(updated);
}

// Soft delete
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireRole("admin");
  if (error) return error;
  const { id } = await params;
  const pid = parseInt(id, 10);
  if (isNaN(pid)) return jsonError("ID invalide", 400);

  const [existing] = await getProduct(pid);
  if (!existing) return jsonError("Produit introuvable", 404);

  await db
    .update(products)
    .set({ deletedAt: new Date(), active: false, updatedAt: new Date() })
    .where(eq(products.id, pid));

  await writeAuditLog({
    user,
    action: "delete",
    entityType: "product",
    entityId: pid,
    oldValues: existing,
  });

  return jsonSuccess({ id: pid, deleted: true });
}
