import { db } from "@/db";
import { inventories, inventoryItems, products } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireUser, jsonError, jsonSuccess } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const countSchema = z.object({
  productId: z.number().int().positive(),
  // null permet d'annuler un comptage déjà saisi.
  countedStock: z.number().int().nonnegative().nullable(),
  note: z.string().optional().nullable(),
});

/** Enregistrer (ou annuler) le comptage physique d'un produit. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser("stock.adjust");
  if (error) return error;
  const { id } = await params;
  const invId = parseInt(id, 10);
  if (Number.isNaN(invId)) return jsonError("ID invalide");

  const [inventory] = await db.select().from(inventories).where(eq(inventories.id, invId)).limit(1);
  if (!inventory) return jsonError("Inventaire introuvable", 404);
  if (inventory.status !== "draft") {
    return jsonError("Cet inventaire est terminé : le comptage n'est plus modifiable", 400);
  }

  const body = await req.json().catch(() => null);
  const parsed = countSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Données invalides");

  const [item] = await db
    .select()
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.inventoryId, invId),
        eq(inventoryItems.productId, parsed.data.productId)
      )
    )
    .limit(1);

  if (!item) return jsonError("Ce produit ne fait pas partie de cet inventaire", 404);

  const counted = parsed.data.countedStock;
  const difference = counted === null ? null : counted - item.systemStock;

  const [updated] = await db
    .update(inventoryItems)
    .set({
      countedStock: counted,
      difference,
      note: parsed.data.note !== undefined ? parsed.data.note : item.note,
      updatedAt: new Date(),
    })
    .where(eq(inventoryItems.id, item.id))
    .returning();

  await writeAuditLog({
    user,
    action: "count_inventory_item",
    entityType: "inventory",
    entityId: invId,
    oldValues: { productId: item.productId, countedStock: item.countedStock },
    newValues: {
      productId: item.productId,
      countedStock: counted,
      difference,
      systemStock: item.systemStock,
    },
  });

  // Renvoie aussi le nom du produit pour l'affichage immédiat.
  const [product] = await db
    .select({ name: products.name })
    .from(products)
    .where(eq(products.id, item.productId))
    .limit(1);

  return jsonSuccess({ ...updated, productName: product?.name });
}
