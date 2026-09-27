import { db } from "@/db";
import { stockMovements, products, users } from "@/db/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { requireUser, jsonSuccess, parseQuery, parseQueryInt } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { error } = await requireUser("stock.view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const page = parseQueryInt(searchParams.get("page")) ?? 1;
  const pageSize = Math.min(parseQueryInt(searchParams.get("pageSize")) ?? 50, 200);
  const productId = parseQueryInt(searchParams.get("productId"));
  const movementType = parseQuery(searchParams.get("type"));
  const dateFrom = parseQuery(searchParams.get("dateFrom"));
  const dateTo = parseQuery(searchParams.get("dateTo"));

  const offset = (page - 1) * pageSize;
  const filters: any[] = [];
  if (productId) filters.push(eq(stockMovements.productId, productId));
  if (movementType) filters.push(eq(stockMovements.movementType, movementType as any));
  if (dateFrom) filters.push(gte(stockMovements.createdAt, new Date(dateFrom)));
  if (dateTo) {
    const d = new Date(dateTo);
    d.setHours(23, 59, 59, 999);
    filters.push(lte(stockMovements.createdAt, d));
  }

  const rows = await db
    .select({
      id: stockMovements.id,
      productId: stockMovements.productId,
      productName: products.name,
      productSku: products.sku,
      movementType: stockMovements.movementType,
      quantity: stockMovements.quantity,
      stockBefore: stockMovements.stockBefore,
      stockAfter: stockMovements.stockAfter,
      unitCost: stockMovements.unitCost,
      referenceType: stockMovements.referenceType,
      referenceId: stockMovements.referenceId,
      note: stockMovements.note,
      userId: stockMovements.userId,
      username: users.username,
      createdAt: stockMovements.createdAt,
    })
    .from(stockMovements)
    .leftJoin(products, eq(stockMovements.productId, products.id))
    .leftJoin(users, eq(stockMovements.userId, users.id))
    .where(and(...filters))
    .orderBy(desc(stockMovements.createdAt))
    .limit(pageSize)
    .offset(offset);

  // Résumé historique global des sorties classifiées.
  // Les quantités sont négatives dans le registre ; ABS les affiche en positif.
  const summaryRows = await db
    .select({
      movementType: stockMovements.movementType,
      quantity: sql<number>`coalesce(abs(sum(${stockMovements.quantity})), 0)`,
      operations: sql<number>`count(*)`,
      value: sql<string>`coalesce(sum(abs(${stockMovements.quantity}) * coalesce(${stockMovements.unitCost}, 0)), 0)`,
    })
    .from(stockMovements)
    .where(
      sql`${stockMovements.movementType} in ('loss', 'damaged', 'return_to_supplier', 'internal_use', 'other')`
    )
    .groupBy(stockMovements.movementType);

  const summary: Record<string, { quantity: number; operations: number; value: number }> = {
    loss: { quantity: 0, operations: 0, value: 0 },
    damaged: { quantity: 0, operations: 0, value: 0 },
    return_to_supplier: { quantity: 0, operations: 0, value: 0 },
    internal_use: { quantity: 0, operations: 0, value: 0 },
    other: { quantity: 0, operations: 0, value: 0 },
  };
  for (const row of summaryRows) {
    if (summary[row.movementType]) {
      summary[row.movementType] = {
        quantity: Number(row.quantity),
        operations: Number(row.operations),
        value: Number(row.value),
      };
    }
  }

  return jsonSuccess({ items: rows, summary, page, pageSize });
}
