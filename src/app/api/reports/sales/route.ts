import { db } from "@/db";
import { sales, saleItems, users, customers, categories, products } from "@/db/schema";
import { eq, gte, lte, and, sql, desc } from "drizzle-orm";
import { requireUser, jsonSuccess, parseQuery } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { error } = await requireUser("report.view");
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const dateFrom = parseQuery(searchParams.get("dateFrom"));
  const dateTo = parseQuery(searchParams.get("dateTo"));

  const filters: any[] = [];
  if (dateFrom) filters.push(gte(sales.createdAt, new Date(dateFrom)));
  if (dateTo) {
    const d = new Date(dateTo);
    d.setHours(23, 59, 59, 999);
    filters.push(lte(sales.createdAt, d));
  }

  // By product
  const byProduct = await db
    .select({
      productId: saleItems.productId,
      productName: saleItems.productName,
      quantity: sql<number>`sum(${saleItems.quantity})`,
      revenue: sql<string>`sum(${saleItems.subtotal})`,
      cost: sql<string>`sum(${saleItems.subtotalCost})`,
      profit: sql<string>`sum(${saleItems.profit})`,
    })
    .from(saleItems)
    .leftJoin(sales, eq(saleItems.saleId, sales.id))
    .where(and(...filters))
    .groupBy(saleItems.productId, saleItems.productName)
    .orderBy(desc(sql`sum(${saleItems.subtotal})`));

  // By vendor
  const byVendor = await db
    .select({
      userId: sales.userId,
      username: users.fullName,
      salesCount: sql<number>`count(distinct ${sales.id})`,
      revenue: sql<string>`sum(${sales.totalAmount})`,
      profit: sql<string>`sum(${sales.profit})`,
    })
    .from(sales)
    .leftJoin(users, eq(sales.userId, users.id))
    .where(and(...filters))
    .groupBy(sales.userId, users.fullName)
    .orderBy(desc(sql`sum(${sales.totalAmount})`));

  // Totals
  const totalsRes = await db
    .select({
      revenue: sql<string>`coalesce(sum(${sales.totalAmount}), 0)`,
      cost: sql<string>`coalesce(sum(${sales.totalCost}), 0)`,
      profit: sql<string>`coalesce(sum(${sales.profit}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(sales)
    .where(and(...filters));

  return jsonSuccess({
    byProduct,
    byVendor,
    totals: totalsRes[0],
  });
}
