import { db } from "@/db";
import { products, categories } from "@/db/schema";
import { eq, isNull, and, sql, asc } from "drizzle-orm";
import { requireUser, jsonSuccess } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireUser("report.view");
  if (error) return error;

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      categoryName: categories.name,
      stock: products.stock,
      minStock: products.minStock,
      purchasePrice: products.purchasePrice,
      retailPrice: products.retailPrice,
      stockValue: sql<string>`${products.stock} * ${products.purchasePrice}`,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(isNull(products.deletedAt), eq(products.active, true)))
    .orderBy(asc(products.name));

  const totals = rows.reduce(
    (acc, r) => {
      acc.totalStock += Number(r.stock);
      acc.totalValue += Number(r.stockValue);
      if (Number(r.stock) <= Number(r.minStock)) acc.lowStock++;
      if (Number(r.stock) === 0) acc.outOfStock++;
      return acc;
    },
    { totalStock: 0, totalValue: 0, lowStock: 0, outOfStock: 0 }
  );

  return jsonSuccess({ items: rows, totals });
}
