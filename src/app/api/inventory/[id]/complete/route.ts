import { db } from "@/db";
import { inventories, inventoryItems, products } from "@/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { requireUser, jsonError, jsonSuccess, getClientIp } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { applyStockChange } from "@/lib/stock";

export const dynamic = "force-dynamic";

/**
 * Finalise un inventaire et applique les corrections de stock.
 *
 * Règle importante : l'écart appliqué est celui constaté au comptage
 * (compté − stock système au moment de l'ouverture), puis il est appliqué au
 * stock ACTUEL. Ainsi, si une vente ou une entrée de marchandise survient
 * pendant le comptage, elle est préservée au lieu d'être écrasée.
 *
 * Exemple : snapshot 38, compté 36 (écart −2). Une vente de 3 survient,
 * le stock actuel passe à 35. À la finalisation : 35 − 2 = 33.
 * La vente et l'écart sont tous deux conservés.
 *
 * Chaque écart produit un mouvement de stock identifiable et tracé.
 * Un stock négatif reste impossible.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser("stock.adjust");
  if (error) return error;
  const { id } = await params;
  const invId = parseInt(id, 10);
  if (Number.isNaN(invId)) return jsonError("ID invalide");

  const [inventory] = await db.select().from(inventories).where(eq(inventories.id, invId)).limit(1);
  if (!inventory) return jsonError("Inventaire introuvable", 404);
  if (inventory.status === "completed") return jsonError("Cet inventaire est déjà terminé");
  if (inventory.status === "archived") return jsonError("Cet inventaire est archivé");

  const countedItems = await db
    .select({
      id: inventoryItems.id,
      productId: inventoryItems.productId,
      systemStock: inventoryItems.systemStock,
      countedStock: inventoryItems.countedStock,
    })
    .from(inventoryItems)
    .where(and(eq(inventoryItems.inventoryId, invId), isNotNull(inventoryItems.countedStock)));

  if (countedItems.length === 0) {
    return jsonError(
      "Aucun produit compté. Saisissez au moins un comptage avant de finaliser.",
      400
    );
  }

  const applied: Array<{
    productId: number;
    counted: number;
    stockBefore: number;
    stockAfter: number;
    delta: number;
  }> = [];
  const warnings: string[] = [];
  let correctedCount = 0;

  try {
    await db.transaction(async (tx) => {
      for (const item of countedItems) {
        const counted = Number(item.countedStock);

        // Lecture du stock réel courant (verrouillé par applyStockChange).
        const [current] = await tx
          .select({ stock: products.stock, name: products.name })
          .from(products)
          .where(eq(products.id, item.productId))
          .limit(1);
        if (!current) continue;

        const stockBefore = Number(current.stock);

        // L'écart est celui constaté au moment du comptage : compté - système.
        // On l'applique ensuite au stock ACTUEL. Ainsi, si une vente ou une
        // entrée de marchandise est survenue pendant le comptage, elle est
        // préservée au lieu d'être écrasée.
        const delta = counted - item.systemStock;

        if (stockBefore !== item.systemStock) {
          warnings.push(
            `${current.name} : stock passé de ${item.systemStock} à ${stockBefore} pendant le comptage (vente ou entrée préservée, écart de ${delta} appliqué)`
          );
        }

        if (delta !== 0) {
          await applyStockChange(tx, {
            productId: item.productId,
            quantity: delta,
            movementType: "inventory",
            referenceType: "inventory",
            referenceId: invId,
            userId: user.id,
            note: `Correction inventaire ${inventory.inventoryNumber} — compté ${counted}, stock système ${item.systemStock}`,
            allowNegative: false,
          });
          correctedCount++;
        }

        // L'écart constaté (compté - système) reste la valeur affichée.
        await tx
          .update(inventoryItems)
          .set({ difference: delta, updatedAt: new Date() })
          .where(eq(inventoryItems.id, item.id));

        applied.push({
          productId: item.productId,
          counted,
          stockBefore,
          stockAfter: stockBefore + delta,
          delta,
        });
      }

      await tx
        .update(inventories)
        .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
        .where(eq(inventories.id, invId));
    });

    await writeAuditLog({
      user,
      action: "complete",
      entityType: "inventory",
      entityId: invId,
      newValues: {
        inventoryNumber: inventory.inventoryNumber,
        countedItems: countedItems.length,
        corrected: correctedCount,
        warnings: warnings.length,
      },
      ip: getClientIp(req),
    });

    return jsonSuccess({
      id: invId,
      status: "completed",
      countedItems: countedItems.length,
      corrected: correctedCount,
      warnings,
    });
  } catch (err: unknown) {
    console.error("Inventory complete error:", err);
    return jsonError(
      err instanceof Error ? err.message : "Erreur lors de la finalisation de l'inventaire",
      400
    );
  }
}
