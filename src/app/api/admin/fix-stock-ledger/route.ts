import { db } from "@/db";
import { products, stockMovements } from "@/db/schema";
import { isNull, sql } from "drizzle-orm";
import { requireUser, jsonError, jsonSuccess } from "@/lib/api-helpers";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

const OPENING_REF = "opening_balance";

/**
 * Régularise le registre des stocks.
 *
 * Objectif : pour chaque produit, stock actuel == somme de ses mouvements.
 * Les produits créés avant la traçabilité complète n'ont pas de mouvement
 * d'ouverture ; on l'ajoute. Le stock réel n'est jamais modifié et
 * l'historique des ventes reste intact.
 *
 * L'opération est idempotente : relancée, elle ne crée plus rien.
 */
export async function POST() {
  const { user, error } = await requireUser();
  if (error) return error;
  if (user.role !== "admin") return jsonError("Accès refusé", 403);

  // 1. Stocks actuels
  const productRows = await db
    .select({
      id: products.id,
      name: products.name,
      stock: products.stock,
      purchasePrice: products.purchasePrice,
    })
    .from(products)
    .where(isNull(products.deletedAt));

  // 2. Somme des mouvements, calculée séparément puis rapprochée en mémoire
  //    (plus fiable qu'une sous-requête corrélée).
  const movementRows = await db
    .select({
      productId: stockMovements.productId,
      total: sql<string>`sum(${stockMovements.quantity})`,
    })
    .from(stockMovements)
    .groupBy(stockMovements.productId);

  const sums = new Map<number, number>();
  for (const m of movementRows) sums.set(m.productId, Number(m.total) || 0);

  const fixed: Array<{ id: number; name: string; opening: number }> = [];

  for (const p of productRows) {
    const current = Number(p.stock);
    const ledger = sums.get(p.id) ?? 0;
    const diff = current - ledger;
    if (diff === 0) continue;

    await db.insert(stockMovements).values({
      productId: p.id,
      movementType: "entry",
      quantity: diff,
      stockBefore: ledger,
      stockAfter: current,
      unitCost: p.purchasePrice,
      referenceType: OPENING_REF,
      userId: user.id,
      note: "Stock d'ouverture régularisé",
    });

    fixed.push({ id: p.id, name: p.name, opening: diff });
  }

  if (fixed.length > 0) {
    await writeAuditLog({
      user,
      action: "fix_stock_ledger",
      entityType: "product",
      newValues: { count: fixed.length },
      note: "Régularisation des stocks d'ouverture",
    });
  }

  return jsonSuccess({ fixed: fixed.length, details: fixed });
}
