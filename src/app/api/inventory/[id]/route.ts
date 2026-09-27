import { db } from "@/db";
import { inventories, inventoryItems, products, categories, stockMovements, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireUser, requireRole, jsonError, jsonSuccess, getClientIp } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { applyStockChange } from "@/lib/stock";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  label: z.string().max(255).optional().nullable(),
  notes: z.string().optional().nullable(),
  // true = archiver un inventaire terminé ; false = le sortir des archives
  archived: z.boolean().optional(),
});

/** Détail d'un inventaire : lignes, statistiques et corrections appliquées. */
export async function GET(_req: Request, { params }: Params) {
  const { error } = await requireUser("stock.view");
  if (error) return error;
  const invId = parseInt((await params).id, 10);
  if (Number.isNaN(invId)) return jsonError("ID invalide");

  const [inventory] = await db
    .select({
      id: inventories.id,
      inventoryNumber: inventories.inventoryNumber,
      label: inventories.label,
      status: inventories.status,
      notes: inventories.notes,
      categoryId: inventories.categoryId,
      categoryName: categories.name,
      userId: inventories.userId,
      username: users.fullName,
      createdAt: inventories.createdAt,
      completedAt: inventories.completedAt,
    })
    .from(inventories)
    .leftJoin(categories, eq(inventories.categoryId, categories.id))
    .leftJoin(users, eq(inventories.userId, users.id))
    .where(eq(inventories.id, invId))
    .limit(1);

  if (!inventory) return jsonError("Inventaire introuvable", 404);

  const items = await db
    .select({
      id: inventoryItems.id,
      productId: inventoryItems.productId,
      productName: products.name,
      productSku: products.sku,
      productBarcode: products.barcode,
      categoryName: categories.name,
      currentStock: products.stock,
      purchasePrice: products.purchasePrice,
      systemStock: inventoryItems.systemStock,
      countedStock: inventoryItems.countedStock,
      difference: inventoryItems.difference,
      note: inventoryItems.note,
    })
    .from(inventoryItems)
    .leftJoin(products, eq(inventoryItems.productId, products.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(inventoryItems.inventoryId, invId))
    .orderBy(products.name);

  let counted = 0;
  let withDiff = 0;
  let diffUnits = 0;
  let diffValue = 0;
  for (const it of items) {
    if (it.countedStock !== null && it.countedStock !== undefined) {
      counted++;
      const diff = Number(it.difference ?? 0);
      if (diff !== 0) {
        withDiff++;
        diffUnits += diff;
        diffValue += diff * Number(it.purchasePrice ?? 0);
      }
    }
  }
  const total = items.length;

  const corrections = await db
    .select({
      id: stockMovements.id,
      productName: products.name,
      quantity: stockMovements.quantity,
      stockBefore: stockMovements.stockBefore,
      stockAfter: stockMovements.stockAfter,
      note: stockMovements.note,
      createdAt: stockMovements.createdAt,
    })
    .from(stockMovements)
    .leftJoin(products, eq(stockMovements.productId, products.id))
    .where(and(eq(stockMovements.referenceType, "inventory"), eq(stockMovements.referenceId, invId)));

  return jsonSuccess({
    inventory,
    items,
    stats: {
      total,
      counted,
      remaining: total - counted,
      withDiff,
      diffUnits,
      diffValue,
      progress: total > 0 ? Math.round((counted / total) * 100) : 0,
    },
    corrections,
  });
}

/** Modifier le titre / les notes, ou archiver / désarchiver un inventaire terminé. */
export async function PUT(req: Request, { params }: Params) {
  const { user, error } = await requireUser("stock.adjust");
  if (error) return error;
  const invId = parseInt((await params).id, 10);
  if (Number.isNaN(invId)) return jsonError("ID invalide");

  const [existing] = await db.select().from(inventories).where(eq(inventories.id, invId)).limit(1);
  if (!existing) return jsonError("Inventaire introuvable", 404);

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Données invalides");

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.label !== undefined) patch.label = parsed.data.label;
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes;

  if (parsed.data.archived !== undefined) {
    if (existing.status === "draft") {
      return jsonError("Un inventaire en cours ne peut pas être archivé. Finalisez-le d'abord.", 400);
    }
    patch.status = parsed.data.archived ? "archived" : "completed";
  }

  const [updated] = await db.update(inventories).set(patch).where(eq(inventories.id, invId)).returning();

  await writeAuditLog({
    user,
    action: parsed.data.archived === undefined ? "update" : parsed.data.archived ? "archive" : "unarchive",
    entityType: "inventory",
    entityId: invId,
    oldValues: { label: existing.label, notes: existing.notes, status: existing.status },
    newValues: { label: updated.label, notes: updated.notes, status: updated.status },
  });

  return jsonSuccess(updated);
}

/**
 * Supprimer un inventaire.
 *
 * - En cours (brouillon) : administrateur ou gestionnaire. Le stock n'a jamais
 *   été modifié, rien d'autre n'est touché.
 * - Terminé ou archivé : administrateur uniquement, avec deux possibilités :
 *   · ?revert=0 (défaut) : on supprime la fiche, le stock reste tel qu'il a été
 *     corrigé et les corrections restent visibles dans Stock & Mouvements ;
 *   · ?revert=1 : on annule aussi les corrections (mouvement inverse tracé),
 *     les ventes survenues depuis étant évidemment conservées.
 */
export async function DELETE(req: Request, { params }: Params) {
  const invId = parseInt((await params).id, 10);
  if (Number.isNaN(invId)) return jsonError("ID invalide");

  const [existing] = await db.select().from(inventories).where(eq(inventories.id, invId)).limit(1);
  if (!existing) return jsonError("Inventaire introuvable", 404);

  const auth =
    existing.status === "draft" ? await requireRole("admin", "manager") : await requireRole("admin");
  if (auth.error) return auth.error;
  const user = auth.user;

  const revert = new URL(req.url).searchParams.get("revert") === "1" && existing.status !== "draft";

  let reverted = 0;
  try {
    await db.transaction(async (tx) => {
      if (revert) {
        const corrections = await tx
          .select({ productId: stockMovements.productId, quantity: stockMovements.quantity })
          .from(stockMovements)
          .where(and(eq(stockMovements.referenceType, "inventory"), eq(stockMovements.referenceId, invId)));

        for (const c of corrections) {
          if (c.quantity === 0) continue;
          await applyStockChange(tx, {
            productId: c.productId,
            quantity: -c.quantity,
            movementType: "correction",
            referenceType: "inventory_revert",
            referenceId: invId,
            userId: user.id,
            note: `Annulation de l'inventaire ${existing.inventoryNumber}`,
            allowNegative: false,
          });
          reverted++;
        }
      }
      // Les lignes sont supprimées automatiquement (ON DELETE CASCADE).
      await tx.delete(inventories).where(eq(inventories.id, invId));
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erreur";
    return jsonError(
      `Impossible d'annuler les corrections : ${message}. Vous pouvez supprimer l'inventaire sans annuler les corrections.`,
      400
    );
  }

  await writeAuditLog({
    user,
    action: "delete",
    entityType: "inventory",
    entityId: invId,
    oldValues: { inventoryNumber: existing.inventoryNumber, status: existing.status },
    newValues: { revertedCorrections: reverted },
    ip: getClientIp(req),
  });

  return jsonSuccess({
    id: invId,
    deleted: true,
    reverted,
    message:
      existing.status === "draft"
        ? "Inventaire en cours supprimé. Le stock n'a pas été modifié."
        : revert
        ? `Inventaire supprimé et ${reverted} correction(s) de stock annulée(s).`
        : "Inventaire supprimé. Le stock garde les corrections déjà appliquées.",
  });
}
