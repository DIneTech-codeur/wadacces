import { db } from "@/db";
import { inventories, inventoryItems } from "@/db/schema";
import { eq, and, isNull, isNotNull, sql } from "drizzle-orm";
import { requireUser, jsonError, jsonSuccess } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  // fill  : chaque produit NON compté reçoit « compté = stock système »
  // reset : efface tous les comptages de l'inventaire
  mode: z.enum(["fill", "reset"]),
});

/**
 * Comptage rapide.
 * « fill » évite de retaper le stock de chaque produit : on remplit tout avec
 * le stock connu, puis on ne corrige que les produits qui diffèrent.
 * Les comptages déjà saisis ne sont jamais écrasés.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser("stock.adjust");
  if (error) return error;
  const invId = parseInt((await params).id, 10);
  if (Number.isNaN(invId)) return jsonError("ID invalide");

  const [inventory] = await db.select().from(inventories).where(eq(inventories.id, invId)).limit(1);
  if (!inventory) return jsonError("Inventaire introuvable", 404);
  if (inventory.status !== "draft") {
    return jsonError("Cet inventaire est terminé : le comptage n'est plus modifiable", 400);
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError("Action invalide");

  let affected: Array<{ id: number }>;
  if (parsed.data.mode === "fill") {
    affected = await db
      .update(inventoryItems)
      .set({ countedStock: sql`${inventoryItems.systemStock}`, difference: 0, updatedAt: new Date() })
      .where(and(eq(inventoryItems.inventoryId, invId), isNull(inventoryItems.countedStock)))
      .returning({ id: inventoryItems.id });
  } else {
    affected = await db
      .update(inventoryItems)
      .set({ countedStock: null, difference: null, updatedAt: new Date() })
      .where(and(eq(inventoryItems.inventoryId, invId), isNotNull(inventoryItems.countedStock)))
      .returning({ id: inventoryItems.id });
  }

  await writeAuditLog({
    user,
    action: parsed.data.mode === "fill" ? "inventory_fill_all" : "inventory_reset_counts",
    entityType: "inventory",
    entityId: invId,
    newValues: { affected: affected.length },
  });

  return jsonSuccess({ mode: parsed.data.mode, affected: affected.length });
}
