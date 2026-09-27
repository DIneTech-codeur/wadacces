import { db } from "@/db";
import { products, categories } from "@/db/schema";
import { eq, or, and, isNull, ilike, sql, desc } from "drizzle-orm";
import { requireUser, jsonError, jsonSuccess, parseQuery } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { error } = await requireUser("product.view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const q = (parseQuery(searchParams.get("q")) || "").trim();
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10) || 20, 100);

  if (!q) {
    // Return top/moving products if no query
    const rows = await db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        barcode: products.barcode,
        purchasePrice: products.purchasePrice,
        retailPrice: products.retailPrice,
        wholesalePrice: products.wholesalePrice,
        stock: products.stock,
        minStock: products.minStock,
        categoryName: categories.name,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(and(isNull(products.deletedAt), eq(products.active, true)))
      .orderBy(desc(products.updatedAt))
      .limit(limit);
    return jsonSuccess(rows);
  }

  const likeQ = `%${q}%`;

  // Try exact barcode match first
  let rows = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      barcode: products.barcode,
      purchasePrice: products.purchasePrice,
      retailPrice: products.retailPrice,
      wholesalePrice: products.wholesalePrice,
      stock: products.stock,
      minStock: products.minStock,
      categoryName: categories.name,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(
      and(
        isNull(products.deletedAt),
        eq(products.active, true),
        eq(products.barcode, q)
      )
    )
    .limit(1);

  if (rows.length > 0) {
    return jsonSuccess(rows);
  }

  // Otherwise do an ILIKE search
  rows = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      barcode: products.barcode,
      purchasePrice: products.purchasePrice,
      retailPrice: products.retailPrice,
      wholesalePrice: products.wholesalePrice,
      stock: products.stock,
      minStock: products.minStock,
      categoryName: categories.name,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(
      and(
        isNull(products.deletedAt),
        eq(products.active, true),
        or(
          ilike(products.name, likeQ),
          ilike(products.sku, likeQ),
          ilike(products.barcode, likeQ),
          ilike(products.brand, likeQ),
          ilike(products.model, likeQ),
          ilike(categories.name, likeQ)
        )
      )
    )
    .orderBy(
      // Prefer items whose name starts with query
      sql`CASE WHEN lower(${products.name}) LIKE lower(${q + "%"}) THEN 0 ELSE 1 END`,
      sql`CHAR_LENGTH(${products.name})`
    )
    .limit(limit);

  return jsonSuccess(rows);
}
