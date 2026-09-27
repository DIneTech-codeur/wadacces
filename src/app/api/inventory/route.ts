import { db } from "@/db";
import { inventories, inventoryItems, products, categories, users } from "@/db/schema";
import { eq, desc, isNull, and, sql } from "drizzle-orm";
import { requireUser, jsonError, jsonSuccess } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";
import { generateNumber } from "@/lib/utils";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * Liste des inventaires avec leurs statistiques de progression.
 *
 * Les statistiques sont calculées en une seule requête groupée, puis
 * rapprochées en mémoire afin d'éviter toute sous-requête corrélée
 * susceptible de produire des totaux faux.
 */
export async function GET() {
  const { error } = await requireUser("stock.view");
  if (error) return error;

  const rows = await db
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
    .orderBy(desc(inventories.createdAt))
    .limit(200);

  // Statistiques agrégées par inventaire.
  const statsRows = await db
    .select({
      inventoryId: inventoryItems.inventoryId,
      total: sql<number>`count(*)`,
      counted: sql<number>`count(${inventoryItems.countedStock})`,
      withDiff: sql<number>`count(*) filter (where ${inventoryItems.difference} is not null and ${inventoryItems.difference} <> 0)`,
      diffUnits: sql<number>`coalesce(sum(${inventoryItems.difference}), 0)`,
      // Valeur d'achat des écarts : négative si le stock réel est inférieur.
      diffValue: sql<string>`coalesce(sum(${inventoryItems.difference} * coalesce(${products.purchasePrice}, 0)), 0)`,
    })
    .from(inventoryItems)
    .leftJoin(products, eq(inventoryItems.productId, products.id))
    .groupBy(inventoryItems.inventoryId);

  const statsById = new Map<number, (typeof statsRows)[number]>();
  for (const s of statsRows) statsById.set(s.inventoryId, s);

  const items = rows.map((r) => {
    const s = statsById.get(r.id);
    const total = Number(s?.total ?? 0);
    const counted = Number(s?.counted ?? 0);
    return {
      ...r,
      stats: {
        total,
        counted,
        remaining: total - counted,
        withDiff: Number(s?.withDiff ?? 0),
        diffUnits: Number(s?.diffUnits ?? 0),
        diffValue: Number(s?.diffValue ?? 0),
        progress: total > 0 ? Math.round((counted / total) * 100) : 0,
      },
    };
  });

  return jsonSuccess(items);
}

const createSchema = z.object({
  label: z.string().max(255).optional().nullable(),
  notes: z.string().optional().nullable(),
  categoryId: z.number().int().positive().optional().nullable(),
});

/**
 * Crée un inventaire en brouillon.
 *
 * Sans catégorie : tous les produits actifs sont listés.
 * Avec catégorie : seuls les produits actifs de cette catégorie sont listés
 * (inventaire partiel, pratique pour compter une vitrine précise).
 */
export async function POST(req: Request) {
  const { user, error } = await requireUser("stock.adjust");
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return jsonError("Données invalides");

  const categoryId = parsed.data.categoryId ?? null;

  if (categoryId) {
    const [cat] = await db
      .select({ id: categories.id, name: categories.name, active: categories.active })
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);
    if (!cat || !cat.active) return jsonError("Catégorie introuvable", 404);
  }

  const filters: ReturnType<typeof eq>[] = [isNull(products.deletedAt), eq(products.active, true)];
  if (categoryId) filters.push(eq(products.categoryId, categoryId));

  const targetProducts = await db
    .select({ id: products.id, stock: products.stock })
    .from(products)
    .where(and(...filters));

  if (targetProducts.length === 0) {
    return jsonError("Aucun produit actif à compter dans cette sélection", 400);
  }

  const [inventory] = await db
    .insert(inventories)
    .values({
      inventoryNumber: "",
      label: parsed.data.label || null,
      userId: user.id,
      status: "draft",
      categoryId,
      notes: parsed.data.notes || null,
    })
    .returning();

  const invNumber = generateNumber("INV", inventory.id);
  await db
    .update(inventories)
    .set({ inventoryNumber: invNumber })
    .where(eq(inventories.id, inventory.id));

  await db.insert(inventoryItems).values(
    targetProducts.map((p) => ({
      inventoryId: inventory.id,
      productId: p.id,
      systemStock: p.stock,
    }))
  );

  await writeAuditLog({
    user,
    action: "create",
    entityType: "inventory",
    entityId: inventory.id,
    newValues: { invNumber, productsCount: targetProducts.length, categoryId },
  });

  return jsonSuccess({
    id: inventory.id,
    inventoryNumber: invNumber,
    productsCount: targetProducts.length,
  });
}
