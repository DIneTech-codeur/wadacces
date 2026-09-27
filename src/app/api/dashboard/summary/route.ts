import { db } from "@/db";
import {
  sales,
  saleItems,
  products,
  categories,
  stockMovements,
} from "@/db/schema";
import { eq, and, gte, lte, sql, desc, isNull } from "drizzle-orm";
import { requireUser, jsonError, jsonSuccess } from "@/lib/api-helpers";
import { toNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireUser();
  if (error) return error;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Aujourd'hui.
  // Important : ne jamais additionner les montants de `sales` avec une jointure
  // sur `sale_items`, sinon chaque vente est comptée autant de fois qu'elle a
  // de lignes et le chiffre d'affaires est gonflé.
  const todayRes = await db
    .select({
      salesCount: sql<number>`count(*)`,
      revenue: sql<string>`coalesce(sum(${sales.totalAmount}), 0)`,
      profit: sql<string>`coalesce(sum(${sales.profit}), 0)`,
    })
    .from(sales)
    .where(gte(sales.createdAt, startOfDay));

  // Nombre d'articles vendus : compté séparément sur les lignes de vente.
  const todayItemsRes = await db
    .select({
      itemsCount: sql<number>`coalesce(sum(${saleItems.quantity}), 0)`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(gte(sales.createdAt, startOfDay));

  const today = {
    ...todayRes[0],
    itemsCount: todayItemsRes[0]?.itemsCount ?? 0,
  };

  // Month
  const monthRes = await db
    .select({
      salesCount: sql<number>`count(distinct ${sales.id})`,
      revenue: sql<string>`coalesce(sum(${sales.totalAmount}), 0)`,
      profit: sql<string>`coalesce(sum(${sales.profit}), 0)`,
    })
    .from(sales)
    .where(gte(sales.createdAt, startOfMonth));
  const month = monthRes[0];

  // Stock summary
  const stockRes = await db
    .select({
      totalProducts: sql<number>`count(*)`,
      totalStock: sql<number>`coalesce(sum(${products.stock}), 0)`,
      stockValue: sql<string>`coalesce(sum(${products.stock} * ${products.purchasePrice}), 0)`,
      lowStock: sql<number>`sum(case when ${products.stock} <= ${products.minStock} then 1 else 0 end)`,
      outOfStock: sql<number>`sum(case when ${products.stock} = 0 then 1 else 0 end)`,
    })
    .from(products)
    .where(and(isNull(products.deletedAt), eq(products.active, true)));
  const stock = stockRes[0];

  // Recent sales (last 10)
  const recentSales = await db
    .select({
      id: sales.id,
      saleNumber: sales.saleNumber,
      totalAmount: sales.totalAmount,
      profit: sales.profit,
      paymentMethod: sales.paymentMethod,
      createdAt: sales.createdAt,
    })
    .from(sales)
    .orderBy(desc(sales.createdAt))
    .limit(10);

  // Recent stock movements (last 10)
  const recentMovements = await db
    .select({
      id: stockMovements.id,
      productId: stockMovements.productId,
      productName: products.name,
      movementType: stockMovements.movementType,
      quantity: stockMovements.quantity,
      stockBefore: stockMovements.stockBefore,
      stockAfter: stockMovements.stockAfter,
      createdAt: stockMovements.createdAt,
    })
    .from(stockMovements)
    .leftJoin(products, eq(stockMovements.productId, products.id))
    .orderBy(desc(stockMovements.createdAt))
    .limit(10);

  // Sales chart last 7 days
  const sevenDaysAgo = new Date(startOfDay);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const chartRes = await db
    .select({
      date: sql<string>`to_char(date_trunc('day', ${sales.createdAt}), 'YYYY-MM-DD')`,
      revenue: sql<string>`coalesce(sum(${sales.totalAmount}), 0)`,
      profit: sql<string>`coalesce(sum(${sales.profit}), 0)`,
      count: sql<number>`count(distinct ${sales.id})`,
    })
    .from(sales)
    .where(gte(sales.createdAt, sevenDaysAgo))
    .groupBy(sql`date_trunc('day', ${sales.createdAt})`)
    .orderBy(sql`date_trunc('day', ${sales.createdAt})`);

  // Top products this month
  const topProductsRes = await db
    .select({
      productId: saleItems.productId,
      productName: saleItems.productName,
      totalQty: sql<number>`sum(${saleItems.quantity})`,
      revenue: sql<string>`sum(${saleItems.subtotal})`,
      profit: sql<string>`sum(${saleItems.profit})`,
    })
    .from(saleItems)
    .leftJoin(sales, eq(saleItems.saleId, sales.id))
    .where(gte(sales.createdAt, startOfMonth))
    .groupBy(saleItems.productId, saleItems.productName)
    .orderBy(desc(sql`sum(${saleItems.quantity})`))
    .limit(10);

  return jsonSuccess({
    today: {
      salesCount: Number(today.salesCount),
      revenue: toNumber(today.revenue),
      profit: toNumber(today.profit),
      itemsCount: Number(today.itemsCount),
    },
    month: {
      salesCount: Number(month.salesCount),
      revenue: toNumber(month.revenue),
      profit: toNumber(month.profit),
    },
    stock: {
      totalProducts: Number(stock.totalProducts),
      totalStock: Number(stock.totalStock),
      stockValue: toNumber(stock.stockValue),
      lowStock: Number(stock.lowStock),
      outOfStock: Number(stock.outOfStock),
    },
    recentSales,
    recentMovements,
    chart: chartRes,
    topProducts: topProductsRes,
  });
}
