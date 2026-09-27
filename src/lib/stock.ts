/**
 * Centralized stock management.
 *
 * All stock changes must go through this module. It uses transactions
 * and creates stock_movement records for full traceability.
 */
import { db } from "@/db";
import { products, stockMovements } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { StockMovementType } from "@/types";

// Allow either db or a drizzle transaction client.
// Drizzle transaction type is not directly exported, so use a minimal interface.
interface Tx {
  select: typeof db.select;
  insert: typeof db.insert;
  update: typeof db.update;
  delete: typeof db.delete;
  transaction: typeof db.transaction;
  execute: typeof db.execute;
}

export interface StockChangeInput {
  productId: number;
  quantity: number; // positive = entry, negative = exit
  movementType: StockMovementType;
  unitCost?: number | string | null;
  referenceType?: string | null;
  referenceId?: number | null;
  referenceLocalId?: string | null;
  userId?: number | null;
  note?: string | null;
  allowNegative?: boolean;
}

function toNumeric(v: number | string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  return typeof v === "string" ? v : String(v);
}

/**
 * Apply a single stock change inside an existing transaction.
 */
export async function applyStockChange(
  tx: Tx,
  input: StockChangeInput
): Promise<{ id: number; stock: number; stockBefore: number }> {
  const {
    productId,
    quantity,
    movementType,
    unitCost,
    referenceType,
    referenceId,
    referenceLocalId,
    userId,
    note,
    allowNegative = false,
  } = input;

  if (!Number.isFinite(quantity) || quantity === 0) {
    throw new Error("La quantité doit être différente de zéro");
  }

  const [product] = await tx
    .select({ id: products.id, stock: products.stock, purchasePrice: products.purchasePrice })
    .from(products)
    .where(eq(products.id, productId))
    .for("update")
    .limit(1);

  if (!product) {
    throw new Error("Produit introuvable");
  }

  const stockBefore = Number(product.stock);
  const stockAfter = stockBefore + quantity;

  if (stockAfter < 0 && !allowNegative) {
    throw new Error(
      `Stock insuffisant pour ce produit. Stock disponible : ${stockBefore}`
    );
  }

  await tx
    .update(products)
    .set({ stock: stockAfter, updatedAt: new Date() })
    .where(eq(products.id, productId));

  const costValue = unitCost !== undefined && unitCost !== null
    ? toNumeric(unitCost)
    : (quantity < 0 ? toNumeric(product.purchasePrice) : null);

  await tx.insert(stockMovements).values({
    productId,
    movementType,
    quantity,
    stockBefore,
    stockAfter,
    unitCost: costValue,
    referenceType: referenceType ?? null,
    referenceId: referenceId ?? null,
    referenceLocalId: referenceLocalId ?? null,
    userId: userId ?? null,
    note: note ?? null,
  });

  return { id: productId, stock: stockAfter, stockBefore };
}

/**
 * Apply multiple stock changes in a single atomic transaction.
 */
export async function applyStockChanges(
  changes: StockChangeInput[]
): Promise<void> {
  await db.transaction(async (tx) => {
    for (const c of changes) {
      await applyStockChange(tx, c);
    }
  });
}
