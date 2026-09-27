import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { eq, sql, and, isNull } from "drizzle-orm";
import { requireUser, jsonError, jsonSuccess } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

/** Détail d'une catégorie + liste de ses produits. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireUser("product.view");
  if (error) return error;
  const { id } = await params;
  const cid = parseInt(id, 10);
  if (Number.isNaN(cid)) return jsonError("ID invalide");

  const [category] = await db.select().from(categories).where(eq(categories.id, cid)).limit(1);
  if (!category) return jsonError("Catégorie introuvable", 404);

  const items = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      barcode: products.barcode,
      stock: products.stock,
      minStock: products.minStock,
      retailPrice: products.retailPrice,
      wholesalePrice: products.wholesalePrice,
      purchasePrice: products.purchasePrice,
      active: products.active,
    })
    .from(products)
    .where(
      and(
        eq(products.categoryId, cid),
        isNull(products.deletedAt),
        eq(products.active, true)
      )
    )
    .orderBy(products.name);

  return jsonSuccess({ category, items });
}

/** Modification réservée à l'administrateur. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (user.role !== "admin") {
    return jsonError("Seul l'administrateur peut modifier une catégorie", 403);
  }

  const { id } = await params;
  const cid = parseInt(id, 10);
  if (Number.isNaN(cid)) return jsonError("ID invalide");

  const [existing] = await db.select().from(categories).where(eq(categories.id, cid)).limit(1);
  if (!existing) return jsonError("Catégorie introuvable", 404);

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Données invalides");

  if (parsed.data.name && parsed.data.name !== existing.name) {
    const [clash] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.name, parsed.data.name))
      .limit(1);
    if (clash) return jsonError("Une catégorie avec ce nom existe déjà", 409);
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.name) patch.name = parsed.data.name;
  if (parsed.data.description !== undefined) patch.description = parsed.data.description;
  if (typeof parsed.data.active === "boolean") patch.active = parsed.data.active;

  const [updated] = await db.update(categories).set(patch).where(eq(categories.id, cid)).returning();

  await writeAuditLog({
    user,
    action: "update",
    entityType: "category",
    entityId: cid,
    oldValues: existing,
    newValues: updated,
  });

  return jsonSuccess(updated);
}

/**
 * Suppression réservée à l'administrateur.
 * Si la catégorie contient des produits, elle est désactivée (jamais supprimée)
 * afin de ne jamais casser la classification de l'historique.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (error) return error;
  if (user.role !== "admin") {
    return jsonError("Seul l'administrateur peut retirer une catégorie", 403);
  }

  const { id } = await params;
  const cid = parseInt(id, 10);
  if (Number.isNaN(cid)) return jsonError("ID invalide");

  const [existing] = await db.select().from(categories).where(eq(categories.id, cid)).limit(1);
  if (!existing) return jsonError("Catégorie introuvable", 404);

  const [count] = await db
    .select({ c: sql<number>`count(*)` })
    .from(products)
    .where(
      and(
        eq(products.categoryId, cid),
        isNull(products.deletedAt),
        eq(products.active, true)
      )
    );

  const productCount = Number(count?.c ?? 0);

  if (productCount > 0) {
    await db
      .update(categories)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(categories.id, cid));
    await writeAuditLog({
      user,
      action: "deactivate",
      entityType: "category",
      entityId: cid,
      note: `Catégorie désactivée (${productCount} produit(s) rattaché(s))`,
    });
    return jsonSuccess({
      id: cid,
      deactivated: true,
      message: `Catégorie désactivée : ${productCount} produit(s) y sont rattachés`,
    });
  }

  await db.delete(categories).where(eq(categories.id, cid));
  await writeAuditLog({
    user,
    action: "delete",
    entityType: "category",
    entityId: cid,
    oldValues: existing,
  });

  return jsonSuccess({ id: cid, deleted: true, message: "Catégorie supprimée" });
}
